package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.CalendarDriveBlockLinkResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.StandingBlockMemberSnapshotDto;
import com.yourorg.quickapp.calendar.StandingBlockTemplateDto;
import com.yourorg.quickapp.calendar.StandingCoverageSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanLegSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRouteOriginSnapshotDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.carpool.CarpoolRideLegResponse;
import com.yourorg.quickapp.carpool.CarpoolRidePlanLegAction;
import com.yourorg.quickapp.carpool.CarpoolRideResponse;
import com.yourorg.quickapp.carpool.CarpoolStandingPlanGroupDto;
import com.yourorg.quickapp.carpool.CarpoolStandingPlanLegDto;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanGroup;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanLeg;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.ForwardRecurrenceGate;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.CalendarRouteMemberRef;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lock / Remove recurring coverage, apply blank future matches, and schedule-
 * ended auto-clear. Reuses CoverageApi + CarpoolApi Save + LeaveByApi home-side
 * writes (no parallel mute path).
 */
@Service
public class StandingBlockLockService {

    /**
     * Feed-backed known schedule length for gate / apply / auto-clear. Agenda UI
     * pagination must not clip this window.
     */
    public static final int KNOWN_SCHEDULE_DAYS = 400;

    private final StandingBlockTemplateService templates;
    private final FeedCalendarApi feedCalendarApi;
    private final CoverageApi coverageApi;
    private final CarpoolApi carpoolApi;
    private final LeaveByApi leaveByApi;
    private final AdultSessionApi adultSessionApi;

    public StandingBlockLockService(
            StandingBlockTemplateService templates,
            FeedCalendarApi feedCalendarApi,
            CoverageApi coverageApi,
            CarpoolApi carpoolApi,
            LeaveByApi leaveByApi,
            AdultSessionApi adultSessionApi) {
        this.templates = templates;
        this.feedCalendarApi = feedCalendarApi;
        this.coverageApi = coverageApi;
        this.carpoolApi = carpoolApi;
        this.leaveByApi = leaveByApi;
        this.adultSessionApi = adultSessionApi;
    }

    /**
     * Upper bound for the known schedule: at least {@code from + KNOWN_SCHEDULE_DAYS},
     * never clipped to a short Agenda page {@code requestTo}.
     */
    public static Instant knownScheduleTo(Instant from, Instant requestTo) {
        Objects.requireNonNull(from, "from");
        Instant knownTo = from.plus(Duration.ofDays(KNOWN_SCHEDULE_DAYS));
        if (requestTo != null && requestTo.isAfter(knownTo)) {
            return requestTo;
        }
        return knownTo;
    }

    /**
     * Lower bound for apply/auto-clear. Load-more page starts after "now" must
     * not become the horizon start (that would miss upcoming matches and
     * falsely auto-clear).
     */
    static Instant knownScheduleFrom(Instant requestFrom, Instant now) {
        Objects.requireNonNull(requestFrom, "requestFrom");
        Objects.requireNonNull(now, "now");
        if (requestFrom.isAfter(now)) {
            return now;
        }
        return requestFrom;
    }

    @Transactional
    public StandingBlockTemplateDto lock(
            AdultResponse adult,
            UUID circleId,
            List<UUID> orderedMemberItemIds,
            String timeZone,
            Instant horizonFrom,
            Instant horizonTo) {
        Objects.requireNonNull(adult, "adult");
        Objects.requireNonNull(circleId, "circleId");
        ZoneId zone = parseZone(timeZone);
        Instant from = Objects.requireNonNull(horizonFrom, "horizonFrom");
        Instant requestTo = Objects.requireNonNull(horizonTo, "horizonTo");
        if (!from.isBefore(requestTo)) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "horizonFrom must be before horizonTo");
        }
        // Gate/apply use the feed-backed known schedule — not the Agenda page.
        Instant to = knownScheduleTo(from, requestTo);
        if (orderedMemberItemIds == null || orderedMemberItemIds.isEmpty()) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST, "memberItemIds must not be empty");
        }

        List<FeedCalendarEventDto> horizon = feedCalendarApi.listEventsInRange(circleId, from, to);
        Map<UUID, FeedCalendarEventDto> byId = new HashMap<>();
        for (FeedCalendarEventDto event : horizon) {
            byId.put(event.id(), event);
        }

        List<FeedCalendarEventDto> members = new ArrayList<>(orderedMemberItemIds.size());
        Set<UUID> seen = new HashSet<>();
        for (UUID itemId : orderedMemberItemIds) {
            if (itemId == null || !seen.add(itemId)) {
                throw new CalendarException(
                        HttpStatus.BAD_REQUEST, "memberItemIds must be distinct FEED ids");
            }
            FeedCalendarEventDto event = byId.get(itemId);
            if (event == null) {
                event =
                        feedCalendarApi
                                .findEventInCircle(circleId, itemId)
                                .orElseThrow(
                                        () ->
                                                new CalendarException(
                                                        HttpStatus.NOT_FOUND,
                                                        "FEED member not found in circle"));
            }
            members.add(event);
        }

        if (!ForwardRecurrenceGate.isLockEligible(members, horizon, zone, from, to)) {
            throw new CalendarException(
                    HttpStatus.CONFLICT,
                    "Lock requires every FEED member to have at least 3 other upcoming matches");
        }

        List<CalendarRouteMemberRef> memberRefs = memberRefs(members);
        List<StandingBlockMemberSnapshotDto> snapshots = new ArrayList<>(members.size());
        for (int i = 0; i < members.size(); i++) {
            FeedCalendarEventDto event = members.get(i);
            snapshots.add(
                    new StandingBlockMemberSnapshotDto(
                            RecurringFeedFingerprint.of(event, zone),
                            i,
                            snapshotCoverages(circleId, event.id()),
                            snapshotRidePlans(circleId, event.id()),
                            List.of()));
        }
        // Block-level route origins live on member index 0 only.
        if (!snapshots.isEmpty()) {
            StandingBlockMemberSnapshotDto first = snapshots.getFirst();
            snapshots.set(
                    0,
                    new StandingBlockMemberSnapshotDto(
                            first.fingerprint(),
                            first.position(),
                            first.coverages(),
                            first.ridePlans(),
                            snapshotRouteOrigins(circleId, members, memberRefs)));
        }

        StandingBlockTemplateDto saved =
                templates.save(circleId, adult.id(), zone.getId(), snapshots);
        // Caller (CalendarService) runs applyAndAutoClear in a separate step so
        // apply-time failures cannot roll back the persisted template.
        return templates
                .findByCircleAndFingerprints(
                        circleId,
                        saved.members().stream()
                                .map(StandingBlockMemberSnapshotDto::fingerprint)
                                .toList())
                .orElse(saved);
    }

    /**
     * Delete the standing template and clear household coverage + ride plans on
     * every fingerprint-matching FEED occurrence with {@code startsAt >= from}
     * (inclusive). Past weeks before {@code from} keep their data. When
     * {@code from} is null, uses {@link Instant#now()}.
     */
    @Transactional
    public boolean remove(UUID circleId, UUID actorAdultId, UUID templateId, Instant from) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(actorAdultId, "actorAdultId");
        Objects.requireNonNull(templateId, "templateId");
        Optional<StandingBlockTemplateDto> found = templates.findByCircleAndId(circleId, templateId);
        if (found.isEmpty()) {
            return false;
        }
        StandingBlockTemplateDto template = found.get();
        Instant clearFrom = from != null ? from : Instant.now();
        clearAppliedFrom(circleId, actorAdultId, template, clearFrom);
        return templates.delete(circleId, templateId);
    }

    /**
     * Clear coverage + active own ride plans on fingerprint matches at/after
     * {@code from} in the known schedule.
     */
    private void clearAppliedFrom(
            UUID circleId,
            UUID actorAdultId,
            StandingBlockTemplateDto template,
            Instant from) {
        ZoneId zone = ZoneId.of(template.timeZone());
        Instant listTo = from.plus(Duration.ofDays(KNOWN_SCHEDULE_DAYS));
        List<FeedCalendarEventDto> horizon =
                feedCalendarApi.listEventsInRange(circleId, from, listTo);
        Set<RecurringFeedFingerprint> fingerprints = new HashSet<>();
        for (StandingBlockMemberSnapshotDto member : template.members()) {
            fingerprints.add(member.fingerprint());
        }
        if (fingerprints.isEmpty()) {
            return;
        }
        for (FeedCalendarEventDto event : horizon) {
            if (event.startsAt().isBefore(from)) {
                continue;
            }
            RecurringFeedFingerprint fingerprint = RecurringFeedFingerprint.of(event, zone);
            if (!fingerprints.contains(fingerprint)) {
                continue;
            }
            clearFeedEventAssignments(circleId, actorAdultId, event.id());
        }
    }

    private void clearFeedEventAssignments(UUID circleId, UUID actorAdultId, UUID feedEventId) {
        for (CoverageAssignmentDto row :
                coverageApi.listForItem(circleId, CoverageItemSource.FEED, feedEventId)) {
            if (row.status() != CoverageStatus.PENDING && row.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            try {
                coverageApi.remove(actorAdultId, row.id());
            } catch (RuntimeException ignored) {
                // Soft-fail one row; continue clearing the rest.
            }
        }
        try {
            carpoolApi.cancelActiveOwnPlansForFeedEvent(circleId, feedEventId);
        } catch (RuntimeException ignored) {
            // Soft-fail plans; coverage already cleared above.
        }
    }

    @Transactional(readOnly = true)
    public List<StandingBlockTemplateDto> listTemplates(UUID circleId) {
        return templates.listForCircle(circleId);
    }

    /**
     * Attach standing Lock eligibility / locked state onto calendar rows for
     * the viewing adult's FEED drive-block components. When {@code timeZone} is
     * null/blank, eligibility stays false (locked can still resolve using each
     * template's stored zone).
     */
    @Transactional(readOnly = true)
    public List<CalendarItemResponse> enrichStandingFields(
            UUID circleId,
            List<CalendarItemResponse> items,
            Instant horizonFrom,
            Instant horizonTo,
            String timeZone) {
        if (items == null || items.isEmpty()) {
            return items == null ? List.of() : items;
        }
        ZoneId viewerZone = null;
        if (timeZone != null && !timeZone.isBlank()) {
            try {
                viewerZone = ZoneId.of(timeZone.trim());
            } catch (Exception ignored) {
                viewerZone = null;
            }
        }
        Instant knownFrom = knownScheduleFrom(horizonFrom, Instant.now());
        Instant knownTo = knownScheduleTo(knownFrom, horizonTo);
        List<FeedCalendarEventDto> horizon =
                feedCalendarApi.listEventsInRange(circleId, knownFrom, knownTo);
        Map<UUID, FeedCalendarEventDto> feedById = new HashMap<>();
        for (FeedCalendarEventDto event : horizon) {
            feedById.put(event.id(), event);
        }
        for (CalendarItemResponse item : items) {
            if (item.source() == CalendarItemSource.FEED && !feedById.containsKey(item.id())) {
                feedCalendarApi
                        .findEventInCircle(circleId, item.id())
                        .ifPresent(event -> feedById.put(event.id(), event));
            }
        }

        List<StandingBlockTemplateDto> active = templates.listForCircle(circleId);
        List<List<CalendarItemResponse>> blocks = driveBlockComponents(items);
        Map<UUID, StandingFields> byItemId = new HashMap<>();
        // Eligibility still uses drive-block components + forward gate.
        for (List<CalendarItemResponse> block : blocks) {
            List<FeedCalendarEventDto> feedMembers = new ArrayList<>();
            for (CalendarItemResponse member : block) {
                if (member.source() != CalendarItemSource.FEED) {
                    continue;
                }
                FeedCalendarEventDto event = feedById.get(member.id());
                if (event != null) {
                    feedMembers.add(event);
                }
            }
            if (feedMembers.isEmpty()) {
                continue;
            }
            boolean eligible = false;
            if (viewerZone != null) {
                eligible =
                        ForwardRecurrenceGate.isLockEligible(
                                feedMembers, horizon, viewerZone, knownFrom, knownTo);
            }
            for (FeedCalendarEventDto member : feedMembers) {
                byItemId.put(member.id(), new StandingFields(eligible, false, null));
            }
        }

        // Locked chrome is fingerprint-based — not drive-block size/order. A
        // singleton card, a merged combined block, or reverse member order must
        // still stamp standingLocked when the item's fingerprint is in a template.
        stampLockedByFingerprint(byItemId, active, feedById, items, viewerZone);

        List<CalendarItemResponse> out = new ArrayList<>(items.size());
        for (CalendarItemResponse item : items) {
            StandingFields fields = byItemId.get(item.id());
            if (fields == null) {
                out.add(withStanding(item, false, false, null));
            } else {
                out.add(
                        withStanding(
                                item,
                                fields.eligible(),
                                fields.locked(),
                                fields.templateId()));
            }
        }
        return List.copyOf(out);
    }

    /**
     * Stamp {@code standingLocked} onto every FEED item whose fingerprint
     * appears in an active template. Does not require the current drive-block
     * component to equal the locked membership set.
     */
    private void stampLockedByFingerprint(
            Map<UUID, StandingFields> byItemId,
            List<StandingBlockTemplateDto> active,
            Map<UUID, FeedCalendarEventDto> feedById,
            List<CalendarItemResponse> items,
            ZoneId viewerZone) {
        if (active == null || active.isEmpty()) {
            return;
        }
        for (StandingBlockTemplateDto template : active) {
            ZoneId zone =
                    viewerZone != null ? viewerZone : ZoneId.of(template.timeZone());
            Set<RecurringFeedFingerprint> templateFingerprints = new HashSet<>();
            for (StandingBlockMemberSnapshotDto member : template.members()) {
                templateFingerprints.add(member.fingerprint());
            }
            if (templateFingerprints.isEmpty()) {
                continue;
            }
            for (CalendarItemResponse item : items) {
                if (item.source() != CalendarItemSource.FEED) {
                    continue;
                }
                FeedCalendarEventDto event = feedById.get(item.id());
                if (event == null) {
                    continue;
                }
                RecurringFeedFingerprint fingerprint =
                        RecurringFeedFingerprint.of(event, zone);
                if (!templateFingerprints.contains(fingerprint)) {
                    continue;
                }
                StandingFields existing = byItemId.get(item.id());
                boolean eligible = existing != null && existing.eligible();
                byItemId.put(
                        item.id(),
                        new StandingFields(eligible, true, template.id()));
            }
        }
    }

    /**
     * FEED drive-block components: union items linked by combined
     * driveBlockLinks; unlinked FEED items are singleton components.
     */
    private static List<List<CalendarItemResponse>> driveBlockComponents(
            List<CalendarItemResponse> items) {
        Map<UUID, CalendarItemResponse> byId = new HashMap<>();
        for (CalendarItemResponse item : items) {
            byId.put(item.id(), item);
        }
        Map<UUID, UUID> parent = new HashMap<>();
        for (CalendarItemResponse item : items) {
            parent.put(item.id(), item.id());
        }
        for (CalendarItemResponse item : items) {
            if (item.driveBlockLinks() == null) {
                continue;
            }
            for (CalendarDriveBlockLinkResponse link : item.driveBlockLinks()) {
                if (!link.combined()) {
                    continue;
                }
                UUID otherId = link.otherId();
                if (!byId.containsKey(otherId)) {
                    continue;
                }
                union(parent, item.id(), otherId);
            }
        }
        Map<UUID, List<CalendarItemResponse>> components = new LinkedHashMap<>();
        for (CalendarItemResponse item : items) {
            if (item.source() != CalendarItemSource.FEED) {
                continue;
            }
            UUID root = find(parent, item.id());
            components.computeIfAbsent(root, ignored -> new ArrayList<>()).add(item);
        }
        // Stable member order by startsAt within each component
        for (List<CalendarItemResponse> component : components.values()) {
            component.sort(
                    (a, b) -> {
                        int cmp = a.startsAt().compareTo(b.startsAt());
                        return cmp != 0 ? cmp : a.id().compareTo(b.id());
                    });
        }
        return List.copyOf(components.values());
    }

    private static void union(Map<UUID, UUID> parent, UUID a, UUID b) {
        UUID ra = find(parent, a);
        UUID rb = find(parent, b);
        if (!ra.equals(rb)) {
            parent.put(ra, rb);
        }
    }

    private static UUID find(Map<UUID, UUID> parent, UUID id) {
        UUID p = parent.get(id);
        if (p == null) {
            parent.put(id, id);
            return id;
        }
        if (!p.equals(id)) {
            UUID root = find(parent, p);
            parent.put(id, root);
            return root;
        }
        return id;
    }

    private static CalendarItemResponse withStanding(
            CalendarItemResponse item,
            boolean eligible,
            boolean locked,
            UUID templateId) {
        return new CalendarItemResponse(
                item.id(),
                item.source(),
                item.title(),
                item.startsAt(),
                item.endsAt(),
                item.location(),
                item.kidIds(),
                item.feedId(),
                item.feedName(),
                item.eventKey(),
                item.leaveFromPlaceId(),
                item.leaveFromPlaceName(),
                item.leaveFromAddress(),
                item.leaveByAt(),
                item.leaveByStatus(),
                item.leaveByReason(),
                item.coverages(),
                item.uncoveredKidIds(),
                item.conflicts(),
                item.rsvps(),
                item.driveBlockLinks(),
                eligible,
                locked,
                templateId);
    }

    private record StandingFields(boolean eligible, boolean locked, UUID templateId) {}

    /**
     * Auto-clear schedule-ended templates, then apply snapshots onto blank
     * future fingerprint matches in the feed-backed known schedule (not the
     * Agenda UI page window).
     */
    @Transactional
    public void applyAndAutoClear(UUID circleId, Instant horizonFrom, Instant horizonTo) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(horizonFrom, "horizonFrom");
        Objects.requireNonNull(horizonTo, "horizonTo");
        Instant knownFrom = knownScheduleFrom(horizonFrom, Instant.now());
        Instant knownTo = knownScheduleTo(knownFrom, horizonTo);
        if (!knownFrom.isBefore(knownTo)) {
            return;
        }
        List<FeedCalendarEventDto> horizon =
                feedCalendarApi.listEventsInRange(circleId, knownFrom, knownTo);
        List<StandingBlockTemplateDto> active = templates.listForCircle(circleId);
        for (StandingBlockTemplateDto template : active) {
            ZoneId templateZone = ZoneId.of(template.timeZone());
            if (shouldAutoClear(template, horizon, templateZone, knownFrom, knownTo)) {
                templates.delete(circleId, template.id());
                continue;
            }
            applyTemplate(circleId, template, horizon, templateZone, knownFrom, knownTo);
        }
    }

    private void applyTemplate(
            UUID circleId,
            StandingBlockTemplateDto template,
            List<FeedCalendarEventDto> horizon,
            ZoneId zone,
            Instant horizonFrom,
            Instant horizonTo) {
        Map<LocalDate, List<FeedCalendarEventDto>> byLocalDay = new LinkedHashMap<>();
        for (FeedCalendarEventDto event : horizon) {
            if (event.startsAt().isBefore(horizonFrom)
                    || !event.startsAt().isBefore(horizonTo)) {
                continue;
            }
            LocalDate day = event.startsAt().atZone(zone).toLocalDate();
            byLocalDay.computeIfAbsent(day, ignored -> new ArrayList<>()).add(event);
        }

        for (Map.Entry<LocalDate, List<FeedCalendarEventDto>> entry : byLocalDay.entrySet()) {
            List<FeedCalendarEventDto> dayEvents = entry.getValue();
            List<FeedCalendarEventDto> matched = new ArrayList<>(template.members().size());
            boolean complete = true;
            for (StandingBlockMemberSnapshotDto member : template.members()) {
                FeedCalendarEventDto hit = findMatch(member.fingerprint(), dayEvents, zone);
                if (hit == null) {
                    complete = false;
                    break;
                }
                matched.add(hit);
            }
            if (!complete) {
                continue;
            }
            boolean anyApplied = false;
            for (int i = 0; i < matched.size(); i++) {
                FeedCalendarEventDto target = matched.get(i);
                if (!isBlankForCircle(circleId, target.id())) {
                    continue;
                }
                applyMemberSnapshot(circleId, target, template.members().get(i));
                anyApplied = true;
            }
            if (anyApplied && !template.members().getFirst().routeOrigins().isEmpty()) {
                applyRouteOrigins(
                        template.members().getFirst().routeOrigins(), matched);
            }
        }
    }

    private void applyMemberSnapshot(
            UUID circleId,
            FeedCalendarEventDto target,
            StandingBlockMemberSnapshotDto snapshot) {
        for (StandingCoverageSnapshotDto coverage : snapshot.coverages()) {
            AdultResponse actor = adultSessionApi.requireAdult(coverage.assignedByAdultId());
            CoverageAssignmentDto assigned =
                    coverageApi.assign(
                            actor.id(),
                            CoverageItemSource.FEED,
                            target.id(),
                            coverage.coveringAdultId(),
                            coverage.kidIds());
            if (coverage.status() == CoverageStatus.CONFIRMED
                    && assigned.status() == CoverageStatus.PENDING) {
                coverageApi.confirm(coverage.coveringAdultId(), assigned.id());
                assigned = coverageApi.requireAssignment(coverage.coveringAdultId(), assigned.id());
            }
            if (coverage.leaveFromPlaceId() != null
                    || (coverage.leaveFromAddress() != null
                            && !coverage.leaveFromAddress().isBlank())) {
                coverageApi.setLeaveFrom(
                        actor.id(),
                        assigned.id(),
                        coverage.leaveFromPlaceId(),
                        coverage.leaveFromAddress());
            }
        }

        if (!snapshot.ridePlans().isEmpty()) {
            List<SaveCarpoolRidePlanGroup> groups = new ArrayList<>();
            for (StandingRidePlanSnapshotDto plan : snapshot.ridePlans()) {
                groups.add(
                        new SaveCarpoolRidePlanGroup(
                                plan.kidIds(), toSaveLegs(plan.legs())));
            }
            // Prefer locking adult's circle member who appears as assignee; else first coverage adult.
            UUID actorId = pickApplyActor(snapshot);
            AdultResponse actor = adultSessionApi.requireAdult(actorId);
            carpoolApi.saveHouseholdPlanForFeedEvent(actor, target.id(), groups);
            // Save writes WAITING_HOUSEHOLD for non-caller assignees — restore
            // CONFIRMED when the locked snapshot had already confirmed them.
            // Use tryConfirm (REQUIRES_NEW) so CONFLICT on the apply actor does
            // not mark the outer Lock transaction rollback-only (→ HTTP 500).
            confirmStandingHouseholdAssignees(snapshot, target.id(), actorId);
        }
    }

    private void confirmStandingHouseholdAssignees(
            StandingBlockMemberSnapshotDto snapshot, UUID feedEventId, UUID applyActorId) {
        Set<UUID> confirmedAssignees = new HashSet<>();
        for (StandingRidePlanSnapshotDto plan : snapshot.ridePlans()) {
            for (StandingRidePlanLegSnapshotDto leg : plan.legs()) {
                if (leg.phase() == CarpoolLegPhase.CONFIRMED && leg.assigneeAdultId() != null) {
                    confirmedAssignees.add(leg.assigneeAdultId());
                }
            }
        }
        for (UUID assigneeId : confirmedAssignees) {
            if (assigneeId.equals(applyActorId)) {
                // Save-as-actor already wrote CONFIRMED for this adult.
                continue;
            }
            try {
                AdultResponse assignee = adultSessionApi.requireAdult(assigneeId);
                carpoolApi.tryConfirmHouseholdPlanForFeedEvent(assignee, feedEventId);
            } catch (RuntimeException ignored) {
                // Soft-fail: leave WAITING_HOUSEHOLD for the assignee to confirm.
            }
        }
    }

    private void applyRouteOrigins(
            List<StandingRouteOriginSnapshotDto> origins,
            List<FeedCalendarEventDto> matchedMembers) {
        List<CalendarRouteMemberRef> refs = memberRefs(matchedMembers);
        FeedCalendarEventDto originEvent = matchedMembers.getFirst();
        for (StandingRouteOriginSnapshotDto origin : origins) {
            try {
                leaveByApi.setCalendarRouteOrigin(
                        origin.adultId(),
                        toRouteLeg(origin.leg()),
                        refs,
                        LeaveByItemSource.FEED,
                        originEvent.id(),
                        originEvent.title(),
                        List.of(),
                        originEvent.location() == null ? "" : originEvent.location(),
                        originEvent.location() == null ? "" : originEvent.location(),
                        origin.leaveFromPlaceId(),
                        origin.leaveFromAddress());
            } catch (RuntimeException ignored) {
                // Soft-fail: block may not be routable yet for that adult.
            }
        }
    }

    private static UUID pickApplyActor(StandingBlockMemberSnapshotDto snapshot) {
        for (StandingRidePlanSnapshotDto plan : snapshot.ridePlans()) {
            for (StandingRidePlanLegSnapshotDto leg : plan.legs()) {
                if (leg.assigneeAdultId() != null) {
                    return leg.assigneeAdultId();
                }
            }
        }
        if (!snapshot.coverages().isEmpty()) {
            return snapshot.coverages().getFirst().assignedByAdultId();
        }
        throw new CalendarException(HttpStatus.BAD_REQUEST, "snapshot has no actor adult");
    }

    private static List<SaveCarpoolRidePlanLeg> toSaveLegs(
            List<StandingRidePlanLegSnapshotDto> legs) {
        List<SaveCarpoolRidePlanLeg> out = new ArrayList<>(2);
        for (StandingRidePlanLegSnapshotDto leg : legs) {
            CarpoolRidePlanLegAction action = toAction(leg.phase());
            if (action == CarpoolRidePlanLegAction.ASK_TEAM) {
                throw new CalendarException(
                        HttpStatus.BAD_REQUEST, "Lock/apply does not support Ask-the-team legs");
            }
            out.add(
                    new SaveCarpoolRidePlanLeg(
                            leg.kind(),
                            action,
                            action == CarpoolRidePlanLegAction.NEEDS_RIDE
                                    ? null
                                    : leg.assigneeAdultId(),
                            action == CarpoolRidePlanLegAction.NEEDS_RIDE ? null : leg.placeId(),
                            // placeAddress in the snapshot is one-time only (never display).
                            action == CarpoolRidePlanLegAction.NEEDS_RIDE || leg.placeId() != null
                                    ? null
                                    : leg.placeAddress(),
                            null));
        }
        return out;
    }

    private static CarpoolRidePlanLegAction toAction(CarpoolLegPhase phase) {
        if (phase == null || phase == CarpoolLegPhase.NEEDS_RIDE) {
            return CarpoolRidePlanLegAction.NEEDS_RIDE;
        }
        if (phase == CarpoolLegPhase.ASKED_TEAM) {
            return CarpoolRidePlanLegAction.ASK_TEAM;
        }
        return CarpoolRidePlanLegAction.HOUSEHOLD;
    }

    private static CalendarRouteLeg toRouteLeg(CarpoolLegKind leg) {
        return leg == CarpoolLegKind.FROM ? CalendarRouteLeg.FROM : CalendarRouteLeg.TO;
    }

    private boolean isBlankForCircle(UUID circleId, UUID feedEventId) {
        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(circleId, CoverageItemSource.FEED, feedEventId);
        for (CoverageAssignmentDto row : coverages) {
            if (row.status() == CoverageStatus.PENDING || row.status() == CoverageStatus.CONFIRMED) {
                return false;
            }
        }
        return !carpoolApi.hasActiveOwnPlansForFeedEvent(circleId, feedEventId);
    }

    private static boolean shouldAutoClear(
            StandingBlockTemplateDto template,
            List<FeedCalendarEventDto> horizon,
            ZoneId zone,
            Instant horizonFrom,
            Instant horizonTo) {
        for (StandingBlockMemberSnapshotDto member : template.members()) {
            if (countMatches(member.fingerprint(), horizon, zone, horizonFrom, horizonTo) > 0) {
                return false;
            }
        }
        return true;
    }

    private static int countMatches(
            RecurringFeedFingerprint fingerprint,
            List<FeedCalendarEventDto> horizon,
            ZoneId zone,
            Instant horizonFrom,
            Instant horizonTo) {
        int count = 0;
        for (FeedCalendarEventDto event : horizon) {
            if (event.startsAt().isBefore(horizonFrom) || !event.startsAt().isBefore(horizonTo)) {
                continue;
            }
            if (RecurringFeedFingerprint.of(event, zone).equals(fingerprint)) {
                count++;
            }
        }
        return count;
    }

    private static FeedCalendarEventDto findMatch(
            RecurringFeedFingerprint fingerprint,
            List<FeedCalendarEventDto> dayEvents,
            ZoneId zone) {
        for (FeedCalendarEventDto event : dayEvents) {
            if (RecurringFeedFingerprint.of(event, zone).equals(fingerprint)) {
                return event;
            }
        }
        return null;
    }

    private List<StandingCoverageSnapshotDto> snapshotCoverages(UUID circleId, UUID itemId) {
        List<StandingCoverageSnapshotDto> out = new ArrayList<>();
        for (CoverageAssignmentDto row :
                coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId)) {
            if (row.status() != CoverageStatus.PENDING && row.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            out.add(
                    new StandingCoverageSnapshotDto(
                            row.coveringAdultId(),
                            row.assignedByAdultId(),
                            row.status(),
                            row.kidIds(),
                            row.leaveFromPlaceId(),
                            row.leaveFromAddress()));
        }
        return List.copyOf(out);
    }

    private List<StandingRidePlanSnapshotDto> snapshotRidePlans(UUID circleId, UUID itemId) {
        List<StandingRidePlanSnapshotDto> out = new ArrayList<>();
        for (CarpoolStandingPlanGroupDto plan :
                carpoolApi.listStandingPlanSnapshotsForFeedEvent(circleId, itemId)) {
            List<StandingRidePlanLegSnapshotDto> legs = new ArrayList<>();
            for (CarpoolStandingPlanLegDto leg : plan.legs()) {
                if (leg.phase() == CarpoolLegPhase.ASKED_TEAM) {
                    throw new CalendarException(
                            HttpStatus.BAD_REQUEST,
                            "Lock does not support Ask-the-team ride plans");
                }
                // Save triad only: placeId XOR oneTimeAddress (never display address).
                legs.add(
                        new StandingRidePlanLegSnapshotDto(
                                leg.kind(),
                                leg.phase(),
                                leg.assigneeAdultId(),
                                leg.assigneeCircleId(),
                                leg.placeId(),
                                null,
                                leg.oneTimeAddress(),
                                leg.meetSide() == null ? CarpoolMeetSide.REQUESTER : leg.meetSide()));
            }
            out.add(new StandingRidePlanSnapshotDto(plan.kidIds(), List.copyOf(legs)));
        }
        return List.copyOf(out);
    }

    private List<StandingRouteOriginSnapshotDto> snapshotRouteOrigins(
            UUID circleId,
            List<FeedCalendarEventDto> members,
            List<CalendarRouteMemberRef> memberRefs) {
        Set<UUID> adults = new HashSet<>();
        for (FeedCalendarEventDto member : members) {
            for (CoverageAssignmentDto row :
                    coverageApi.listForItem(circleId, CoverageItemSource.FEED, member.id())) {
                if (row.status() == CoverageStatus.CONFIRMED
                        || row.status() == CoverageStatus.PENDING) {
                    adults.add(row.coveringAdultId());
                }
            }
            for (CarpoolRideResponse plan :
                    carpoolApi.listActiveOwnPlansForFeedEvent(circleId, member.id())) {
                for (CarpoolRideLegResponse leg : plan.legs()) {
                    if (leg.assigneeAdultId() != null) {
                        adults.add(leg.assigneeAdultId());
                    }
                }
            }
        }
        List<StandingRouteOriginSnapshotDto> out = new ArrayList<>();
        for (UUID adultId : adults) {
            for (CarpoolLegKind legKind : List.of(CarpoolLegKind.TO, CarpoolLegKind.FROM)) {
                leaveByApi
                        .findItineraryHomeSide(adultId, toRouteLeg(legKind), memberRefs)
                        .ifPresent(
                                home ->
                                        out.add(
                                                new StandingRouteOriginSnapshotDto(
                                                        adultId,
                                                        legKind,
                                                        home.leaveFromPlaceId(),
                                                        null,
                                                        home.leaveFromAddress())));
            }
        }
        return List.copyOf(out);
    }

    private static List<CalendarRouteMemberRef> memberRefs(List<FeedCalendarEventDto> members) {
        List<CalendarRouteMemberRef> refs = new ArrayList<>(members.size());
        for (FeedCalendarEventDto member : members) {
            refs.add(new CalendarRouteMemberRef(LeaveByItemSource.FEED, member.id()));
        }
        return List.copyOf(refs);
    }

    private static ZoneId parseZone(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "timeZone is required");
        }
        try {
            return ZoneId.of(timeZone.trim());
        } catch (Exception ex) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "timeZone is invalid");
        }
    }
}
