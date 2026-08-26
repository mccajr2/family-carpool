package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.AssignCalendarCoverageRequest;
import com.yourorg.quickapp.calendar.CalendarConflictResponse;
import com.yourorg.quickapp.calendar.CalendarCoverageAssignmentResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.CalendarLeaveByResponse;
import com.yourorg.quickapp.calendar.CalendarRsvpResponse;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.coverage.ScheduleIntervals;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CalendarService {

    private final FamilyMembershipApi familyMembershipApi;
    private final FeedCalendarApi feedCalendarApi;
    private final ManualEventCalendarApi manualEventCalendarApi;
    private final LeaveByApi leaveByApi;
    private final CoverageApi coverageApi;
    private final RsvpApi rsvpApi;
    private final AdultSessionApi adultSessionApi;

    public CalendarService(
            FamilyMembershipApi familyMembershipApi,
            FeedCalendarApi feedCalendarApi,
            ManualEventCalendarApi manualEventCalendarApi,
            LeaveByApi leaveByApi,
            CoverageApi coverageApi,
            RsvpApi rsvpApi,
            AdultSessionApi adultSessionApi) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedCalendarApi = feedCalendarApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.leaveByApi = leaveByApi;
        this.coverageApi = coverageApi;
        this.rsvpApi = rsvpApi;
        this.adultSessionApi = adultSessionApi;
    }

    public List<CalendarItemResponse> list(AdultResponse adult, Instant from, Instant to) {
        requireValidRange(from, to);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());

        List<FeedCalendarEventDto> feedEvents =
                feedCalendarApi.listEventsInRange(circleId, from, to);
        List<ManualCalendarEventDto> manualEvents =
                manualEventCalendarApi.listInRange(circleId, from, to);

        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> detection =
                buildDetectionSet(circleId, feedEvents, manualEvents);
        Map<CalendarConflictDetector.ItemKey, List<CalendarConflictResponse>> conflictsByItem =
                CalendarConflictDetector.detect(
                        List.copyOf(detection.values()), adultNamesFor(detection.values()));

        Map<UUID, List<CoverageAssignmentDto>> feedCoverages =
                groupCoverages(
                        coverageApi.listForItems(
                                circleId,
                                CoverageItemSource.FEED,
                                feedEvents.stream().map(FeedCalendarEventDto::id).toList()));
        Map<UUID, List<CoverageAssignmentDto>> manualCoverages =
                groupCoverages(
                        coverageApi.listForItems(
                                circleId,
                                CoverageItemSource.MANUAL,
                                manualEvents.stream().map(ManualCalendarEventDto::id).toList()));

        Map<UUID, List<RsvpDto>> feedRsvps =
                groupRsvps(
                        rsvpApi.listForItems(
                                circleId,
                                RsvpItemSource.FEED,
                                feedEvents.stream().map(FeedCalendarEventDto::id).toList()));
        Map<UUID, List<RsvpDto>> manualRsvps =
                groupRsvps(
                        rsvpApi.listForItems(
                                circleId,
                                RsvpItemSource.MANUAL,
                                manualEvents.stream().map(ManualCalendarEventDto::id).toList()));

        Map<UUID, String> adultNames = displayNamesFor(feedCoverages, manualCoverages);

        List<LeaveByEnrichmentDto> leaveBys =
                leaveByApi.enrichCheapMany(
                        adult.id(), leaveByInputs(feedEvents, manualEvents));

        List<CalendarItemResponse> items = new ArrayList<>();
        int index = 0;
        for (FeedCalendarEventDto feedEvent : feedEvents) {
            items.add(
                    fromFeed(
                            feedEvent,
                            feedCoverages.getOrDefault(feedEvent.id(), List.of()),
                            feedRsvps.getOrDefault(feedEvent.id(), List.of()),
                            adultNames,
                            conflictsByItem.getOrDefault(
                                    new CalendarConflictDetector.ItemKey(
                                            CalendarItemSource.FEED, feedEvent.id()),
                                    List.of()),
                            leaveBys.get(index++)));
        }
        for (ManualCalendarEventDto manual : manualEvents) {
            items.add(
                    fromManual(
                            manual,
                            manualCoverages.getOrDefault(manual.id(), List.of()),
                            manualRsvps.getOrDefault(manual.id(), List.of()),
                            adultNames,
                            conflictsByItem.getOrDefault(
                                    new CalendarConflictDetector.ItemKey(
                                            CalendarItemSource.MANUAL, manual.id()),
                                    List.of()),
                            leaveBys.get(index++)));
        }

        items.sort(
                Comparator.comparing(CalendarItemResponse::startsAt)
                        .thenComparing(item -> item.source().name())
                        .thenComparing(CalendarItemResponse::id));
        return List.copyOf(items);
    }

    public List<CalendarLeaveByResponse> listLeaveBy(
            AdultResponse adult, Instant from, Instant to) {
        requireValidRange(from, to);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());

        List<FeedCalendarEventDto> feedEvents =
                feedCalendarApi.listEventsInRange(circleId, from, to);
        List<ManualCalendarEventDto> manualEvents =
                manualEventCalendarApi.listInRange(circleId, from, to);

        List<LeaveByItemInput> inputs = leaveByInputs(feedEvents, manualEvents);
        List<LeaveByEnrichmentDto> leaveBys = leaveByApi.enrichMany(adult.id(), inputs);

        Map<UUID, Instant> startsAtById = new HashMap<>();
        List<CalendarLeaveByResponse> rows = new ArrayList<>(inputs.size());
        int index = 0;
        for (FeedCalendarEventDto feedEvent : feedEvents) {
            startsAtById.put(feedEvent.id(), feedEvent.startsAt());
            rows.add(toLeaveByResponse(feedEvent.id(), CalendarItemSource.FEED, leaveBys.get(index++)));
        }
        for (ManualCalendarEventDto manual : manualEvents) {
            startsAtById.put(manual.id(), manual.startsAt());
            rows.add(toLeaveByResponse(manual.id(), CalendarItemSource.MANUAL, leaveBys.get(index++)));
        }
        rows.sort(
                Comparator.comparing((CalendarLeaveByResponse row) -> startsAtById.get(row.id()))
                        .thenComparing(row -> row.source().name())
                        .thenComparing(CalendarLeaveByResponse::id));
        return List.copyOf(rows);
    }

    public CalendarItemResponse setLeaveFrom(
            AdultResponse adult, CalendarItemSource source, UUID itemId, UUID placeId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        leaveByApi.setLeaveFrom(adult.id(), toLeaveBySource(source), itemId, placeId);
        return requireItem(adult.id(), circleId, source, itemId);
    }

    public CalendarItemResponse assignCoverage(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            AssignCalendarCoverageRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        rejectNoRsvpKids(circleId, source, itemId, request.kidIds());
        coverageApi.assign(
                adult.id(),
                toCoverageSource(source),
                itemId,
                request.coveringAdultId(),
                request.kidIds());
        ensureYes(circleId, source, itemId, request.kidIds(), adult.id());
        return requireItem(adult.id(), circleId, source, itemId);
    }

    public CalendarItemResponse reassignCoverage(
            AdultResponse adult, UUID assignmentId, AssignCalendarCoverageRequest request) {
        CoverageAssignmentDto existing = coverageApi.requireAssignment(adult.id(), assignmentId);
        CalendarItemSource source = toCalendarSource(existing.itemSource());
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        rejectNoRsvpKids(circleId, source, existing.itemId(), request.kidIds());
        CoverageAssignmentDto updated =
                coverageApi.reassign(
                        adult.id(),
                        assignmentId,
                        request.coveringAdultId(),
                        request.kidIds());
        ensureYes(circleId, source, updated.itemId(), request.kidIds(), adult.id());
        return requireItem(adult.id(), circleId, source, updated.itemId());
    }

    public CalendarItemResponse removeCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto existing = coverageApi.requireAssignment(adult.id(), assignmentId);
        coverageApi.remove(adult.id(), assignmentId);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(
                adult.id(),
                circleId,
                toCalendarSource(existing.itemSource()),
                existing.itemId());
    }

    public CalendarItemResponse confirmCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto updated = coverageApi.confirm(adult.id(), assignmentId);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CalendarItemSource source = toCalendarSource(updated.itemSource());
        ensureYes(circleId, source, updated.itemId(), updated.kidIds(), adult.id());
        return requireItem(adult.id(), circleId, source, updated.itemId());
    }

    public CalendarItemResponse declineCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto updated = coverageApi.decline(adult.id(), assignmentId);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(
                adult.id(),
                circleId,
                toCalendarSource(updated.itemSource()),
                updated.itemId());
    }

    public CalendarItemResponse setRsvp(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            UUID kidId,
            RsvpStatus status) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        List<UUID> itemKids = requireItemKidIds(circleId, source, itemId);
        if (!itemKids.contains(kidId)) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "Kid is not on this calendar item");
        }
        if (status == RsvpStatus.NO || status == RsvpStatus.NO_RESPONSE) {
            coverageApi.releaseKidFromActiveRows(
                    circleId, toCoverageSource(source), itemId, kidId);
        }
        rsvpApi.setStatus(
                circleId, toRsvpSource(source), itemId, kidId, status, adult.id());
        return requireItem(adult.id(), circleId, source, itemId);
    }

    private static void requireValidRange(Instant from, Instant to) {
        if (from == null || to == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (!from.isBefore(to)) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from must be before to");
        }
    }

    private CalendarItemResponse requireItem(
            UUID adultId, UUID circleId, CalendarItemSource source, UUID itemId) {
        return switch (source) {
            case MANUAL -> {
                ManualCalendarEventDto event =
                        manualEventCalendarApi
                                .findInCircle(circleId, itemId)
                                .orElseThrow(
                                        () ->
                                                new CalendarException(
                                                        HttpStatus.NOT_FOUND,
                                                        "Calendar item not found"));
                yield enrichSingle(adultId, circleId, event, null);
            }
            case FEED -> {
                FeedCalendarEventDto event =
                        feedCalendarApi
                                .findEventInCircle(circleId, itemId)
                                .orElseThrow(
                                        () ->
                                                new CalendarException(
                                                        HttpStatus.NOT_FOUND,
                                                        "Calendar item not found"));
                yield enrichSingle(adultId, circleId, null, event);
            }
        };
    }

    private CalendarItemResponse enrichSingle(
            UUID adultId,
            UUID circleId,
            ManualCalendarEventDto manual,
            FeedCalendarEventDto feed) {
        List<FeedCalendarEventDto> feedSeed =
                feed == null ? List.of() : List.of(feed);
        List<ManualCalendarEventDto> manualSeed =
                manual == null ? List.of() : List.of(manual);
        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> detection =
                buildDetectionSet(circleId, feedSeed, manualSeed);
        Map<CalendarConflictDetector.ItemKey, List<CalendarConflictResponse>> conflictsByItem =
                CalendarConflictDetector.detect(
                        List.copyOf(detection.values()), adultNamesFor(detection.values()));

        if (manual != null) {
            List<CoverageAssignmentDto> coverages =
                    coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, manual.id());
            List<RsvpDto> rsvps =
                    rsvpApi.listForItems(
                            circleId, RsvpItemSource.MANUAL, List.of(manual.id()));
            LeaveByEnrichmentDto leaveBy =
                    leaveByApi.enrich(
                            adultId,
                            LeaveByItemSource.MANUAL,
                            manual.id(),
                            manual.startsAt(),
                            manual.location());
            return fromManual(
                    manual,
                    coverages,
                    rsvps,
                    displayNames(coverages),
                    conflictsByItem.getOrDefault(
                            new CalendarConflictDetector.ItemKey(
                                    CalendarItemSource.MANUAL, manual.id()),
                            List.of()),
                    leaveBy);
        }
        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(circleId, CoverageItemSource.FEED, feed.id());
        List<RsvpDto> rsvps =
                rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(feed.id()));
        LeaveByEnrichmentDto leaveBy =
                leaveByApi.enrich(
                        adultId,
                        LeaveByItemSource.FEED,
                        feed.id(),
                        feed.startsAt(),
                        feed.location());
        return fromFeed(
                feed,
                coverages,
                rsvps,
                displayNames(coverages),
                conflictsByItem.getOrDefault(
                        new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, feed.id()),
                        List.of()),
                leaveBy);
    }

    private Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem>
            buildDetectionSet(
                    UUID circleId,
                    List<FeedCalendarEventDto> feedInPage,
                    List<ManualCalendarEventDto> manualInPage) {
        Instant windowStart = null;
        Instant windowEnd = null;
        for (FeedCalendarEventDto event : feedInPage) {
            windowStart = minStart(windowStart, event.startsAt());
            windowEnd = maxEnd(windowEnd, event.startsAt(), event.endsAt());
        }
        for (ManualCalendarEventDto event : manualInPage) {
            windowStart = minStart(windowStart, event.startsAt());
            windowEnd = maxEnd(windowEnd, event.startsAt(), event.endsAt());
        }

        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> byKey =
                new LinkedHashMap<>();
        for (FeedCalendarEventDto event : feedInPage) {
            byKey.put(
                    new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, event.id()),
                    toScheduleItem(event, List.of()));
        }
        for (ManualCalendarEventDto event : manualInPage) {
            byKey.put(
                    new CalendarConflictDetector.ItemKey(CalendarItemSource.MANUAL, event.id()),
                    toScheduleItem(event, List.of()));
        }

        if (windowStart != null && windowEnd != null) {
            for (FeedCalendarEventDto event :
                    feedCalendarApi.listEventsOverlapping(circleId, windowStart, windowEnd)) {
                byKey.putIfAbsent(
                        new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, event.id()),
                        toScheduleItem(event, List.of()));
            }
            for (ManualCalendarEventDto event :
                    manualEventCalendarApi.listOverlapping(circleId, windowStart, windowEnd)) {
                byKey.putIfAbsent(
                        new CalendarConflictDetector.ItemKey(
                                CalendarItemSource.MANUAL, event.id()),
                        toScheduleItem(event, List.of()));
            }
        }

        List<UUID> feedIds =
                byKey.keySet().stream()
                        .filter(k -> k.source() == CalendarItemSource.FEED)
                        .map(CalendarConflictDetector.ItemKey::id)
                        .toList();
        List<UUID> manualIds =
                byKey.keySet().stream()
                        .filter(k -> k.source() == CalendarItemSource.MANUAL)
                        .map(CalendarConflictDetector.ItemKey::id)
                        .toList();

        Map<UUID, List<CoverageAssignmentDto>> feedCoverages =
                groupCoverages(
                        coverageApi.listForItems(circleId, CoverageItemSource.FEED, feedIds));
        Map<UUID, List<CoverageAssignmentDto>> manualCoverages =
                groupCoverages(
                        coverageApi.listForItems(circleId, CoverageItemSource.MANUAL, manualIds));
        Map<UUID, List<RsvpDto>> feedRsvps =
                groupRsvps(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, feedIds));
        Map<UUID, List<RsvpDto>> manualRsvps =
                groupRsvps(rsvpApi.listForItems(circleId, RsvpItemSource.MANUAL, manualIds));

        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> withCoverage =
                new LinkedHashMap<>();
        for (var entry : byKey.entrySet()) {
            CalendarConflictDetector.ScheduleItem base = entry.getValue();
            List<CoverageAssignmentDto> coverages =
                    base.source() == CalendarItemSource.FEED
                            ? feedCoverages.getOrDefault(base.id(), List.of())
                            : manualCoverages.getOrDefault(base.id(), List.of());
            List<RsvpDto> rsvps =
                    base.source() == CalendarItemSource.FEED
                            ? feedRsvps.getOrDefault(base.id(), List.of())
                            : manualRsvps.getOrDefault(base.id(), List.of());
            withCoverage.put(
                    entry.getKey(),
                    toScheduleItem(
                            base,
                            inPlayKidIds(base.kidIds(), rsvps),
                            activeCoverages(coverages)));
        }
        return withCoverage;
    }

    private static CalendarConflictDetector.ScheduleItem toScheduleItem(
            FeedCalendarEventDto event, List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.kidIds(),
                coverages);
    }

    private static CalendarConflictDetector.ScheduleItem toScheduleItem(
            ManualCalendarEventDto event, List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.kidIds(),
                coverages);
    }

    private static CalendarConflictDetector.ScheduleItem toScheduleItem(
            CalendarConflictDetector.ScheduleItem base,
            List<UUID> inPlayKidIds,
            List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                base.id(),
                base.source(),
                base.title(),
                base.startsAt(),
                base.endsAt(),
                inPlayKidIds,
                coverages);
    }

    private static List<CalendarConflictDetector.ActiveCoverage> activeCoverages(
            List<CoverageAssignmentDto> coverages) {
        List<CalendarConflictDetector.ActiveCoverage> active = new ArrayList<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() == CoverageStatus.PENDING
                    || coverage.status() == CoverageStatus.CONFIRMED) {
                active.add(
                        new CalendarConflictDetector.ActiveCoverage(
                                coverage.coveringAdultId(), coverage.status()));
            }
        }
        return List.copyOf(active);
    }

    private Map<UUID, String> adultNamesFor(
            Iterable<CalendarConflictDetector.ScheduleItem> items) {
        Set<UUID> adultIds = new HashSet<>();
        for (CalendarConflictDetector.ScheduleItem item : items) {
            for (CalendarConflictDetector.ActiveCoverage coverage : item.activeCoverages()) {
                adultIds.add(coverage.adultId());
            }
        }
        return resolveDisplayNames(adultIds);
    }

    private static Instant minStart(Instant current, Instant startsAt) {
        if (current == null || startsAt.isBefore(current)) {
            return startsAt;
        }
        return current;
    }

    private static Instant maxEnd(Instant current, Instant startsAt, Instant endsAt) {
        Instant end = ScheduleIntervals.endExclusive(startsAt, endsAt);
        if (current == null || end.isAfter(current)) {
            return end;
        }
        return current;
    }

    private CalendarItemResponse fromFeed(
            FeedCalendarEventDto event,
            List<CoverageAssignmentDto> coverages,
            List<RsvpDto> rsvps,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts,
            LeaveByEnrichmentDto leaveBy) {
        return toResponse(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                event.feedId(),
                event.feedName(),
                FeedEventKey.of(event),
                leaveBy,
                coverages,
                rsvps,
                adultNames,
                conflicts);
    }

    private CalendarItemResponse fromManual(
            ManualCalendarEventDto event,
            List<CoverageAssignmentDto> coverages,
            List<RsvpDto> rsvps,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts,
            LeaveByEnrichmentDto leaveBy) {
        return toResponse(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                null,
                null,
                null,
                leaveBy,
                coverages,
                rsvps,
                adultNames,
                conflicts);
    }

    private static List<LeaveByItemInput> leaveByInputs(
            List<FeedCalendarEventDto> feedEvents, List<ManualCalendarEventDto> manualEvents) {
        List<LeaveByItemInput> inputs =
                new ArrayList<>(feedEvents.size() + manualEvents.size());
        for (FeedCalendarEventDto feedEvent : feedEvents) {
            inputs.add(
                    new LeaveByItemInput(
                            LeaveByItemSource.FEED,
                            feedEvent.id(),
                            feedEvent.startsAt(),
                            feedEvent.location()));
        }
        for (ManualCalendarEventDto manual : manualEvents) {
            inputs.add(
                    new LeaveByItemInput(
                            LeaveByItemSource.MANUAL,
                            manual.id(),
                            manual.startsAt(),
                            manual.location()));
        }
        return inputs;
    }

    private static CalendarLeaveByResponse toLeaveByResponse(
            UUID id, CalendarItemSource source, LeaveByEnrichmentDto leaveBy) {
        return new CalendarLeaveByResponse(
                id,
                source,
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason());
    }

    private static CalendarItemResponse toResponse(
            UUID id,
            CalendarItemSource source,
            String title,
            Instant startsAt,
            Instant endsAt,
            String location,
            List<UUID> kidIds,
            UUID feedId,
            String feedName,
            String eventKey,
            LeaveByEnrichmentDto leaveBy,
            List<CoverageAssignmentDto> coverages,
            List<RsvpDto> rsvps,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts) {
        List<CalendarCoverageAssignmentResponse> coverageResponses =
                coverages.stream()
                        .map(
                                c ->
                                        new CalendarCoverageAssignmentResponse(
                                                c.id(),
                                                c.coveringAdultId(),
                                                adultNames.get(c.coveringAdultId()),
                                                c.assignedByAdultId(),
                                                c.kidIds(),
                                                c.status()))
                        .toList();
        List<CalendarRsvpResponse> rsvpResponses = materializeRsvps(kidIds, rsvps);
        return new CalendarItemResponse(
                id,
                source,
                title,
                startsAt,
                endsAt,
                location,
                kidIds,
                feedId,
                feedName,
                eventKey,
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason(),
                coverageResponses,
                uncoveredKidIds(kidIds, coverages, rsvps),
                conflicts == null ? List.of() : List.copyOf(conflicts),
                rsvpResponses);
    }

    static List<UUID> uncoveredKidIds(
            List<UUID> kidIds, List<CoverageAssignmentDto> coverages, List<RsvpDto> rsvps) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        Set<UUID> covered = new HashSet<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() == CoverageStatus.PENDING
                    || coverage.status() == CoverageStatus.CONFIRMED) {
                covered.addAll(coverage.kidIds());
            }
        }
        Map<UUID, RsvpStatus> byKid = statusByKid(rsvps);
        return kidIds.stream()
                .filter(id -> byKid.getOrDefault(id, RsvpStatus.NO_RESPONSE) != RsvpStatus.NO)
                .filter(id -> !covered.contains(id))
                .toList();
    }

    static List<CalendarRsvpResponse> materializeRsvps(List<UUID> kidIds, List<RsvpDto> rsvps) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, RsvpStatus> byKid = statusByKid(rsvps);
        return kidIds.stream()
                .map(
                        kidId ->
                                new CalendarRsvpResponse(
                                        kidId, byKid.getOrDefault(kidId, RsvpStatus.NO_RESPONSE)))
                .toList();
    }

    static List<UUID> inPlayKidIds(List<UUID> kidIds, List<RsvpDto> rsvps) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, RsvpStatus> byKid = statusByKid(rsvps);
        return kidIds.stream()
                .filter(id -> byKid.getOrDefault(id, RsvpStatus.NO_RESPONSE) != RsvpStatus.NO)
                .toList();
    }

    private static Map<UUID, RsvpStatus> statusByKid(List<RsvpDto> rsvps) {
        if (rsvps == null || rsvps.isEmpty()) {
            return Map.of();
        }
        return rsvps.stream()
                .collect(Collectors.toMap(RsvpDto::kidId, RsvpDto::status, (a, b) -> b));
    }

    private void rejectNoRsvpKids(
            UUID circleId, CalendarItemSource source, UUID itemId, List<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            return;
        }
        Map<UUID, RsvpStatus> byKid =
                statusByKid(
                        rsvpApi.listForItems(
                                circleId, toRsvpSource(source), List.of(itemId)));
        for (UUID kidId : kidIds) {
            if (byKid.getOrDefault(kidId, RsvpStatus.NO_RESPONSE) == RsvpStatus.NO) {
                throw new CalendarException(
                        HttpStatus.BAD_REQUEST, "Cannot cover a kid with RSVP No");
            }
        }
    }

    private void ensureYes(
            UUID circleId,
            CalendarItemSource source,
            UUID itemId,
            List<UUID> kidIds,
            UUID updatedByAdultId) {
        if (kidIds == null || kidIds.isEmpty()) {
            return;
        }
        RsvpItemSource rsvpSource = toRsvpSource(source);
        for (UUID kidId : kidIds) {
            rsvpApi.setStatus(
                    circleId, rsvpSource, itemId, kidId, RsvpStatus.YES, updatedByAdultId);
        }
    }

    private List<UUID> requireItemKidIds(UUID circleId, CalendarItemSource source, UUID itemId) {
        return switch (source) {
            case MANUAL ->
                    manualEventCalendarApi
                            .findInCircle(circleId, itemId)
                            .orElseThrow(
                                    () ->
                                            new CalendarException(
                                                    HttpStatus.NOT_FOUND, "Calendar item not found"))
                            .kidIds();
            case FEED ->
                    feedCalendarApi
                            .findEventInCircle(circleId, itemId)
                            .orElseThrow(
                                    () ->
                                            new CalendarException(
                                                    HttpStatus.NOT_FOUND, "Calendar item not found"))
                            .kidIds();
        };
    }

    private Map<UUID, String> displayNamesFor(
            Map<UUID, List<CoverageAssignmentDto>> feedCoverages,
            Map<UUID, List<CoverageAssignmentDto>> manualCoverages) {
        Set<UUID> adultIds = new HashSet<>();
        feedCoverages.values().forEach(list -> list.forEach(c -> adultIds.add(c.coveringAdultId())));
        manualCoverages
                .values()
                .forEach(list -> list.forEach(c -> adultIds.add(c.coveringAdultId())));
        return resolveDisplayNames(adultIds);
    }

    private Map<UUID, String> displayNames(List<CoverageAssignmentDto> coverages) {
        return resolveDisplayNames(
                coverages.stream()
                        .map(CoverageAssignmentDto::coveringAdultId)
                        .collect(Collectors.toSet()));
    }

    private Map<UUID, String> resolveDisplayNames(Set<UUID> adultIds) {
        Map<UUID, String> names = new HashMap<>();
        for (UUID adultId : adultIds) {
            AdultResponse adult = adultSessionApi.requireAdult(adultId);
            names.put(adultId, adult.displayName());
        }
        return names;
    }

    private static Map<UUID, List<CoverageAssignmentDto>> groupCoverages(
            List<CoverageAssignmentDto> coverages) {
        return coverages.stream().collect(Collectors.groupingBy(CoverageAssignmentDto::itemId));
    }

    private static Map<UUID, List<RsvpDto>> groupRsvps(List<RsvpDto> rsvps) {
        return rsvps.stream().collect(Collectors.groupingBy(RsvpDto::itemId));
    }

    private static LeaveByItemSource toLeaveBySource(CalendarItemSource source) {
        return switch (source) {
            case MANUAL -> LeaveByItemSource.MANUAL;
            case FEED -> LeaveByItemSource.FEED;
        };
    }

    private static CoverageItemSource toCoverageSource(CalendarItemSource source) {
        return switch (source) {
            case MANUAL -> CoverageItemSource.MANUAL;
            case FEED -> CoverageItemSource.FEED;
        };
    }

    private static RsvpItemSource toRsvpSource(CalendarItemSource source) {
        return switch (source) {
            case MANUAL -> RsvpItemSource.MANUAL;
            case FEED -> RsvpItemSource.FEED;
        };
    }

    private static CalendarItemSource toCalendarSource(CoverageItemSource source) {
        return switch (source) {
            case MANUAL -> CalendarItemSource.MANUAL;
            case FEED -> CalendarItemSource.FEED;
        };
    }
}
