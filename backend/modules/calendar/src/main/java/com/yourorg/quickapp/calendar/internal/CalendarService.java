package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.AssignCalendarCoverageRequest;
import com.yourorg.quickapp.calendar.CalendarConflictResponse;
import com.yourorg.quickapp.calendar.CalendarCoverageAssignmentResponse;
import com.yourorg.quickapp.calendar.CalendarCoverageLeaveByResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.CalendarLeaveByResponse;
import com.yourorg.quickapp.calendar.CalendarPlaylistOpenResponse;
import com.yourorg.quickapp.calendar.CalendarPlaylistResponse;
import com.yourorg.quickapp.calendar.CalendarRouteNotifyContactResponse;
import com.yourorg.quickapp.calendar.CalendarRouteResponse;
import com.yourorg.quickapp.calendar.CalendarRouteStopResponse;
import com.yourorg.quickapp.calendar.CalendarRsvpResponse;
import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.coverage.ScheduleIntervals;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.leaveby.CalendarRouteDto;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveFromEnrichmentInput;
import com.yourorg.quickapp.playlist.RidePlaylistApi;
import com.yourorg.quickapp.playlist.RidePlaylistAttendingKid;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CalendarService {

    private final FamilyMembershipApi familyMembershipApi;
    private final FeedCalendarApi feedCalendarApi;
    private final ManualEventCalendarApi manualEventCalendarApi;
    private final LeaveByApi leaveByApi;
    private final CoverageApi coverageApi;
    private final RsvpApi rsvpApi;
    private final AdultSessionApi adultSessionApi;
    private final CarpoolApi carpoolApi;
    private final RidePlaylistApi ridePlaylistApi;

    public CalendarService(
            FamilyMembershipApi familyMembershipApi,
            FeedCalendarApi feedCalendarApi,
            ManualEventCalendarApi manualEventCalendarApi,
            LeaveByApi leaveByApi,
            CoverageApi coverageApi,
            RsvpApi rsvpApi,
            AdultSessionApi adultSessionApi,
            CarpoolApi carpoolApi,
            RidePlaylistApi ridePlaylistApi) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedCalendarApi = feedCalendarApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.leaveByApi = leaveByApi;
        this.coverageApi = coverageApi;
        this.rsvpApi = rsvpApi;
        this.adultSessionApi = adultSessionApi;
        this.carpoolApi = carpoolApi;
        this.ridePlaylistApi = ridePlaylistApi;
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

        Map<ItemLeaveMetaKey, ItemLeaveMeta> itemMeta =
                itemLeaveMeta(feedEvents, manualEvents);
        Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys =
                enrichCoverageLeaveBys(
                        flattenCoverages(feedCoverages, manualCoverages), itemMeta, false);

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
                            leaveBys.get(index++),
                            coverageLeaveBys));
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
                            leaveBys.get(index++),
                            coverageLeaveBys));
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
        Map<ItemLeaveMetaKey, ItemLeaveMeta> itemMeta =
                itemLeaveMeta(feedEvents, manualEvents);
        Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys =
                enrichCoverageLeaveBys(
                        flattenCoverages(feedCoverages, manualCoverages), itemMeta, true);

        Map<UUID, Instant> startsAtById = new HashMap<>();
        List<CalendarLeaveByResponse> rows = new ArrayList<>(inputs.size());
        int index = 0;
        for (FeedCalendarEventDto feedEvent : feedEvents) {
            startsAtById.put(feedEvent.id(), feedEvent.startsAt());
            rows.add(
                    toLeaveByResponse(
                            feedEvent.id(),
                            CalendarItemSource.FEED,
                            leaveBys.get(index++),
                            feedCoverages.getOrDefault(feedEvent.id(), List.of()),
                            coverageLeaveBys));
        }
        for (ManualCalendarEventDto manual : manualEvents) {
            startsAtById.put(manual.id(), manual.startsAt());
            rows.add(
                    toLeaveByResponse(
                            manual.id(),
                            CalendarItemSource.MANUAL,
                            leaveBys.get(index++),
                            manualCoverages.getOrDefault(manual.id(), List.of()),
                            coverageLeaveBys));
        }
        rows.sort(
                Comparator.comparing((CalendarLeaveByResponse row) -> startsAtById.get(row.id()))
                        .thenComparing(row -> row.source().name())
                        .thenComparing(CalendarLeaveByResponse::id));
        return List.copyOf(rows);
    }

    @Transactional
    public CalendarRouteResponse getRoute(
            AdultResponse adult, CalendarItemSource source, UUID itemId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ItemSnapshot item = requireItemSnapshot(circleId, source, itemId);
        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(circleId, toCoverageSource(source), itemId);
        List<RsvpDto> rsvps =
                rsvpApi.listForItems(circleId, toRsvpSource(source), List.of(itemId));
        List<CarpoolAcceptedPickupDto> acceptedPickups =
                source == CalendarItemSource.FEED
                        ? carpoolApi.listAcceptedPickupsForFeedEvent(circleId, itemId)
                        : List.of();

        UUID drivingAdultId =
                resolveDrivingAdultId(adult.id(), circleId, item.kidIds(), coverages, rsvps, acceptedPickups)
                        .orElseThrow(
                                () ->
                                        new CalendarException(
                                                HttpStatus.FORBIDDEN,
                                                "Not allowed to route this calendar item"));

        List<CalendarRoutePickupInput> pickups =
                pickupsForDriver(drivingAdultId, acceptedPickups);
        CalendarRouteDto route =
                leaveByApi.getOrRefreshCalendarRoute(
                        drivingAdultId,
                        toLeaveBySource(source),
                        itemId,
                        item.title(),
                        pickups,
                        destinationName(item),
                        item.location());
        return toRouteResponse(route);
    }

    @Transactional
    public CalendarPlaylistResponse getPlaylist(
            AdultResponse adult, CalendarItemSource source, UUID itemId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ItemSnapshot item = requireItemSnapshot(circleId, source, itemId);
        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(circleId, toCoverageSource(source), itemId);
        List<RsvpDto> rsvps =
                rsvpApi.listForItems(circleId, toRsvpSource(source), List.of(itemId));
        List<CarpoolAcceptedPickupDto> acceptedPickups =
                source == CalendarItemSource.FEED
                        ? carpoolApi.listAcceptedPickupsForFeedEvent(circleId, itemId)
                        : List.of();

        UUID drivingAdultId =
                resolveDrivingAdultId(adult.id(), circleId, item.kidIds(), coverages, rsvps, acceptedPickups)
                        .orElseThrow(
                                () ->
                                        new CalendarException(
                                                HttpStatus.FORBIDDEN,
                                                "Not allowed to route this calendar item"));

        List<RidePlaylistAttendingKid> attending =
                resolveAttendingKids(source, itemId, drivingAdultId, acceptedPickups);
        return new CalendarPlaylistResponse(ridePlaylistApi.enrichRiders(adult.id(), attending));
    }

    @Transactional
    public CalendarPlaylistOpenResponse openPlaylist(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            List<String> remixedTrackUris) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ItemSnapshot item = requireItemSnapshot(circleId, source, itemId);
        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(circleId, toCoverageSource(source), itemId);
        List<RsvpDto> rsvps =
                rsvpApi.listForItems(circleId, toRsvpSource(source), List.of(itemId));
        List<CarpoolAcceptedPickupDto> acceptedPickups =
                source == CalendarItemSource.FEED
                        ? carpoolApi.listAcceptedPickupsForFeedEvent(circleId, itemId)
                        : List.of();

        UUID drivingAdultId =
                resolveDrivingAdultId(adult.id(), circleId, item.kidIds(), coverages, rsvps, acceptedPickups)
                        .orElseThrow(
                                () ->
                                        new CalendarException(
                                                HttpStatus.FORBIDDEN,
                                                "Not allowed to route this calendar item"));

        List<RidePlaylistAttendingKid> attending =
                resolveAttendingKids(source, itemId, drivingAdultId, acceptedPickups);
        var riders = ridePlaylistApi.enrichRiders(adult.id(), attending);
        var opened = ridePlaylistApi.openHandoff(adult.id(), riders, remixedTrackUris);
        return new CalendarPlaylistOpenResponse(opened.url());
    }

    public CalendarItemResponse setLeaveFrom(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            UUID leaveFromPlaceId,
            String leaveFromAddress) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        leaveByApi.setLeaveFrom(
                adult.id(),
                toLeaveBySource(source),
                itemId,
                leaveFromPlaceId,
                leaveFromAddress);
        leaveByApi.invalidateCalendarRoute(adult.id(), toLeaveBySource(source), itemId);
        return requireItem(adult.id(), circleId, source, itemId);
    }

    public CalendarItemResponse setCoverageLeaveFrom(
            AdultResponse adult,
            UUID assignmentId,
            UUID leaveFromPlaceId,
            String leaveFromAddress) {
        CoverageAssignmentDto existing = coverageApi.requireAssignment(adult.id(), assignmentId);
        CoverageAssignmentDto updated =
                coverageApi.setLeaveFrom(
                        adult.id(), assignmentId, leaveFromPlaceId, leaveFromAddress);
        CalendarItemSource source = toCalendarSource(updated.itemSource());
        if (updated.status() == CoverageStatus.CONFIRMED
                || existing.status() == CoverageStatus.CONFIRMED) {
            leaveByApi.invalidateCalendarRoute(
                    updated.coveringAdultId(), toLeaveBySource(source), updated.itemId());
        }
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(adult.id(), circleId, source, updated.itemId());
    }

    public CalendarItemResponse assignCoverage(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            AssignCalendarCoverageRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        rejectNoRsvpKids(circleId, source, itemId, request.kidIds());
        CoverageAssignmentDto assigned =
                coverageApi.assign(
                        adult.id(),
                        toCoverageSource(source),
                        itemId,
                        request.coveringAdultId(),
                        request.kidIds());
        ensureYes(circleId, source, itemId, request.kidIds(), adult.id());
        if (assigned.status() == CoverageStatus.CONFIRMED) {
            upsertCoverageDriverRoute(circleId, source, itemId, assigned.coveringAdultId());
        }
        return requireItem(adult.id(), circleId, source, itemId);
    }

    public CalendarItemResponse reassignCoverage(
            AdultResponse adult, UUID assignmentId, AssignCalendarCoverageRequest request) {
        CoverageAssignmentDto existing = coverageApi.requireAssignment(adult.id(), assignmentId);
        CalendarItemSource source = toCalendarSource(existing.itemSource());
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        rejectNoRsvpKids(circleId, source, existing.itemId(), request.kidIds());
        UUID previousDriverId =
                existing.status() == CoverageStatus.CONFIRMED ? existing.coveringAdultId() : null;
        CoverageAssignmentDto updated =
                coverageApi.reassign(
                        adult.id(),
                        assignmentId,
                        request.coveringAdultId(),
                        request.kidIds());
        ensureYes(circleId, source, updated.itemId(), request.kidIds(), adult.id());
        if (previousDriverId != null && !previousDriverId.equals(updated.coveringAdultId())) {
            leaveByApi.invalidateCalendarRoute(
                    previousDriverId, toLeaveBySource(source), updated.itemId());
        }
        if (updated.status() == CoverageStatus.CONFIRMED) {
            upsertCoverageDriverRoute(circleId, source, updated.itemId(), updated.coveringAdultId());
        }
        return requireItem(adult.id(), circleId, source, updated.itemId());
    }

    @Transactional
    public CalendarItemResponse removeCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto existing = coverageApi.requireAssignment(adult.id(), assignmentId);
        if (existing.status() == CoverageStatus.CONFIRMED
                && existing.itemSource() == CoverageItemSource.FEED) {
            carpoolApi.withdrawAcceptedInboundForFeedEvent(adult.id(), existing.itemId());
        }
        coverageApi.remove(adult.id(), assignmentId);
        if (existing.status() == CoverageStatus.CONFIRMED) {
            leaveByApi.invalidateCalendarRoute(
                    existing.coveringAdultId(),
                    toLeaveBySource(toCalendarSource(existing.itemSource())),
                    existing.itemId());
        }
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
        upsertCoverageDriverRoute(circleId, source, updated.itemId(), updated.coveringAdultId());
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

    @Transactional
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
            CoverageItemSource coverageSource = toCoverageSource(source);
            coverageApi.releaseKidFromActiveRows(circleId, coverageSource, itemId, kidId);
            if (source == CalendarItemSource.FEED
                    && !hasConfirmedCoverage(circleId, coverageSource, itemId)) {
                carpoolApi.withdrawAcceptedInboundForFeedEvent(adult.id(), itemId);
            }
        }
        rsvpApi.setStatus(
                circleId, toRsvpSource(source), itemId, kidId, status, adult.id());
        return requireItem(adult.id(), circleId, source, itemId);
    }

    private boolean hasConfirmedCoverage(
            UUID circleId, CoverageItemSource source, UUID itemId) {
        return coverageApi.listForItem(circleId, source, itemId).stream()
                .anyMatch(coverage -> coverage.status() == CoverageStatus.CONFIRMED);
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
            Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys =
                    enrichCoverageLeaveBys(
                            coverages,
                            Map.of(
                                    new ItemLeaveMetaKey(CoverageItemSource.MANUAL, manual.id()),
                                    new ItemLeaveMeta(manual.startsAt(), manual.location())),
                            true);
            return fromManual(
                    manual,
                    coverages,
                    rsvps,
                    displayNames(coverages),
                    conflictsByItem.getOrDefault(
                            new CalendarConflictDetector.ItemKey(
                                    CalendarItemSource.MANUAL, manual.id()),
                            List.of()),
                    leaveBy,
                    coverageLeaveBys);
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
        Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys =
                enrichCoverageLeaveBys(
                        coverages,
                        Map.of(
                                new ItemLeaveMetaKey(CoverageItemSource.FEED, feed.id()),
                                new ItemLeaveMeta(feed.startsAt(), feed.location())),
                        true);
        return fromFeed(
                feed,
                coverages,
                rsvps,
                displayNames(coverages),
                conflictsByItem.getOrDefault(
                        new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, feed.id()),
                        List.of()),
                leaveBy,
                coverageLeaveBys);
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
            LeaveByEnrichmentDto leaveBy,
            Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys) {
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
                conflicts,
                coverageLeaveBys);
    }

    private CalendarItemResponse fromManual(
            ManualCalendarEventDto event,
            List<CoverageAssignmentDto> coverages,
            List<RsvpDto> rsvps,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts,
            LeaveByEnrichmentDto leaveBy,
            Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys) {
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
                conflicts,
                coverageLeaveBys);
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
            UUID id,
            CalendarItemSource source,
            LeaveByEnrichmentDto leaveBy,
            List<CoverageAssignmentDto> coverages,
            Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys) {
        List<CalendarCoverageLeaveByResponse> coverageRows = new ArrayList<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() != CoverageStatus.PENDING
                    && coverage.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            LeaveByEnrichmentDto coverageLeaveBy =
                    coverageLeaveBys.getOrDefault(
                            coverage.id(),
                            LeaveByEnrichmentDto.unavailable(null, null, "NO_ORIGIN"));
            coverageRows.add(
                    new CalendarCoverageLeaveByResponse(
                            coverage.id(),
                            coverageLeaveBy.leaveFromPlaceId(),
                            coverageLeaveBy.leaveFromPlaceName(),
                            coverageLeaveBy.leaveFromAddress(),
                            coverageLeaveBy.leaveByAt(),
                            coverageLeaveBy.leaveByStatus(),
                            coverageLeaveBy.leaveByReason()));
        }
        return new CalendarLeaveByResponse(
                id,
                source,
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveFromAddress(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason(),
                List.copyOf(coverageRows));
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
            List<CalendarConflictResponse> conflicts,
            Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys) {
        List<CalendarCoverageAssignmentResponse> coverageResponses =
                coverages.stream()
                        .map(c -> toCoverageResponse(c, adultNames, coverageLeaveBys))
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
                leaveBy.leaveFromAddress(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason(),
                coverageResponses,
                uncoveredKidIds(kidIds, coverages, rsvps),
                conflicts == null ? List.of() : List.copyOf(conflicts),
                rsvpResponses);
    }

    private static CalendarCoverageAssignmentResponse toCoverageResponse(
            CoverageAssignmentDto coverage,
            Map<UUID, String> adultNames,
            Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys) {
        LeaveByEnrichmentDto leaveBy = coverageLeaveBys.get(coverage.id());
        if (leaveBy == null) {
            return new CalendarCoverageAssignmentResponse(
                    coverage.id(),
                    coverage.coveringAdultId(),
                    adultNames.get(coverage.coveringAdultId()),
                    coverage.assignedByAdultId(),
                    coverage.kidIds(),
                    coverage.status(),
                    coverage.leaveFromPlaceId(),
                    null,
                    coverage.leaveFromAddress(),
                    null,
                    null,
                    null);
        }
        return new CalendarCoverageAssignmentResponse(
                coverage.id(),
                coverage.coveringAdultId(),
                adultNames.get(coverage.coveringAdultId()),
                coverage.assignedByAdultId(),
                coverage.kidIds(),
                coverage.status(),
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveFromAddress() != null
                        ? leaveBy.leaveFromAddress()
                        : coverage.leaveFromAddress(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason());
    }

    private Map<UUID, LeaveByEnrichmentDto> enrichCoverageLeaveBys(
            Collection<CoverageAssignmentDto> coverages,
            Map<ItemLeaveMetaKey, ItemLeaveMeta> itemMeta,
            boolean allowHttp) {
        List<CoverageAssignmentDto> active = new ArrayList<>();
        List<LeaveFromEnrichmentInput> inputs = new ArrayList<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() != CoverageStatus.PENDING
                    && coverage.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            ItemLeaveMeta meta =
                    itemMeta.get(
                            new ItemLeaveMetaKey(coverage.itemSource(), coverage.itemId()));
            if (meta == null) {
                continue;
            }
            active.add(coverage);
            inputs.add(
                    new LeaveFromEnrichmentInput(
                            coverage.coveringAdultId(),
                            coverage.leaveFromPlaceId(),
                            coverage.leaveFromAddress(),
                            meta.startsAt(),
                            meta.location()));
        }
        if (inputs.isEmpty()) {
            return Map.of();
        }
        List<LeaveByEnrichmentDto> enriched =
                leaveByApi.enrichForLeaveFromMany(inputs, allowHttp);
        Map<UUID, LeaveByEnrichmentDto> byAssignment = new HashMap<>();
        for (int i = 0; i < active.size(); i++) {
            byAssignment.put(active.get(i).id(), enriched.get(i));
        }
        return byAssignment;
    }

    private static List<CoverageAssignmentDto> flattenCoverages(
            Map<UUID, List<CoverageAssignmentDto>> feedCoverages,
            Map<UUID, List<CoverageAssignmentDto>> manualCoverages) {
        List<CoverageAssignmentDto> all = new ArrayList<>();
        for (List<CoverageAssignmentDto> rows : feedCoverages.values()) {
            all.addAll(rows);
        }
        for (List<CoverageAssignmentDto> rows : manualCoverages.values()) {
            all.addAll(rows);
        }
        return all;
    }

    private static Map<ItemLeaveMetaKey, ItemLeaveMeta> itemLeaveMeta(
            List<FeedCalendarEventDto> feedEvents, List<ManualCalendarEventDto> manualEvents) {
        Map<ItemLeaveMetaKey, ItemLeaveMeta> meta = new HashMap<>();
        for (FeedCalendarEventDto feed : feedEvents) {
            meta.put(
                    new ItemLeaveMetaKey(CoverageItemSource.FEED, feed.id()),
                    new ItemLeaveMeta(feed.startsAt(), feed.location()));
        }
        for (ManualCalendarEventDto manual : manualEvents) {
            meta.put(
                    new ItemLeaveMetaKey(CoverageItemSource.MANUAL, manual.id()),
                    new ItemLeaveMeta(manual.startsAt(), manual.location()));
        }
        return meta;
    }

    private record ItemLeaveMetaKey(CoverageItemSource source, UUID itemId) {}

    private record ItemLeaveMeta(Instant startsAt, String location) {}

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

    private void upsertCoverageDriverRoute(
            UUID circleId, CalendarItemSource source, UUID itemId, UUID drivingAdultId) {
        ItemSnapshot item = requireItemSnapshot(circleId, source, itemId);
        List<CarpoolAcceptedPickupDto> acceptedPickups =
                source == CalendarItemSource.FEED
                        ? carpoolApi.listAcceptedPickupsForFeedEvent(circleId, itemId)
                        : List.of();
        leaveByApi.upsertCalendarRoute(
                drivingAdultId,
                toLeaveBySource(source),
                itemId,
                item.title(),
                pickupsForDriver(drivingAdultId, acceptedPickups),
                destinationName(item),
                item.location());
    }

    private Optional<UUID> resolveDrivingAdultId(
            UUID callerAdultId,
            UUID callerCircleId,
            List<UUID> itemKidIds,
            List<CoverageAssignmentDto> coverages,
            List<RsvpDto> rsvps,
            List<CarpoolAcceptedPickupDto> acceptedPickups) {
        Map<UUID, RsvpStatus> byKid = statusByKid(rsvps);
        Set<UUID> inPlayKids =
                itemKidIds.stream()
                        .filter(id -> byKid.getOrDefault(id, RsvpStatus.NO_RESPONSE) != RsvpStatus.NO)
                        .collect(Collectors.toSet());
        if (inPlayKids.isEmpty()) {
            return Optional.empty();
        }

        for (CarpoolAcceptedPickupDto pickup : acceptedPickups) {
            boolean sharesKid = pickup.kidIds().stream().anyMatch(inPlayKids::contains);
            if (!sharesKid) {
                continue;
            }
            if (callerCircleId.equals(pickup.acceptingCircleId())
                    || callerCircleId.equals(pickup.requestingCircleId())) {
                return Optional.of(pickup.acceptedByAdultId());
            }
        }

        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            if (!coverage.coveringAdultId().equals(callerAdultId)) {
                continue;
            }
            boolean sharesKid = coverage.kidIds().stream().anyMatch(inPlayKids::contains);
            if (sharesKid) {
                return Optional.of(callerAdultId);
            }
        }
        return Optional.empty();
    }

    /**
     * Kids in the car for Playlist tiles: driving adult's CONFIRMED in-play
     * household kids plus ACCEPTED pickup kids for that driver (same idea as
     * route pickups / rider chips). Stable order: household kids then pickups.
     */
    private List<RidePlaylistAttendingKid> resolveAttendingKids(
            CalendarItemSource source,
            UUID itemId,
            UUID drivingAdultId,
            List<CarpoolAcceptedPickupDto> acceptedPickups) {
        List<CarpoolAcceptedPickupDto> driverPickups =
                acceptedPickups.stream()
                        .filter(p -> drivingAdultId.equals(p.acceptedByAdultId()))
                        .toList();

        UUID driverCircleId =
                driverPickups.stream()
                        .map(CarpoolAcceptedPickupDto::acceptingCircleId)
                        .findFirst()
                        .orElseGet(
                                () ->
                                        familyMembershipApi.requireMemberCircleId(
                                                drivingAdultId));

        LinkedHashMap<UUID, RidePlaylistAttendingKid> byKid = new LinkedHashMap<>();

        ItemSnapshot driverItem = requireItemSnapshot(driverCircleId, source, itemId);
        List<CoverageAssignmentDto> driverCoverages =
                coverageApi.listForItem(driverCircleId, toCoverageSource(source), itemId);
        List<RsvpDto> driverRsvps =
                rsvpApi.listForItems(driverCircleId, toRsvpSource(source), List.of(itemId));
        Set<UUID> inPlayDriver =
                driverItem.kidIds().stream()
                        .filter(
                                id ->
                                        statusByKid(driverRsvps)
                                                        .getOrDefault(id, RsvpStatus.NO_RESPONSE)
                                                != RsvpStatus.NO)
                        .collect(Collectors.toSet());

        String driverCircleLabel =
                familyMembershipApi
                        .findCircle(driverCircleId)
                        .map(FamilyCircleName::name)
                        .filter(n -> n != null && !n.isBlank())
                        .orElse("Family");

        for (CoverageAssignmentDto coverage : driverCoverages) {
            if (coverage.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            if (!drivingAdultId.equals(coverage.coveringAdultId())) {
                continue;
            }
            List<UUID> covered =
                    coverage.kidIds().stream().filter(inPlayDriver::contains).toList();
            Map<UUID, String> names =
                    familyMembershipApi.findKids(driverCircleId, covered).stream()
                            .collect(Collectors.toMap(FamilyKidName::id, FamilyKidName::displayName));
            for (UUID kidId : covered) {
                String display = names.getOrDefault(kidId, "Kid");
                byKid.putIfAbsent(
                        kidId, new RidePlaylistAttendingKid(kidId, display, driverCircleLabel));
            }
        }

        Set<UUID> pickupCircleIds =
                driverPickups.stream()
                        .map(CarpoolAcceptedPickupDto::requestingCircleId)
                        .collect(Collectors.toCollection(HashSet::new));
        Map<UUID, String> pickupCircleNames = new HashMap<>();
        for (FamilyCircleName row : familyMembershipApi.findCircles(pickupCircleIds)) {
            pickupCircleNames.put(
                    row.id(),
                    row.name() == null || row.name().isBlank() ? "Family" : row.name());
        }

        for (CarpoolAcceptedPickupDto pickup : driverPickups) {
            String inviteLabel =
                    pickupCircleNames.getOrDefault(pickup.requestingCircleId(), "Family");
            Map<UUID, String> names =
                    familyMembershipApi
                            .findKids(pickup.requestingCircleId(), pickup.kidIds())
                            .stream()
                            .collect(
                                    Collectors.toMap(
                                            FamilyKidName::id, FamilyKidName::displayName));
            for (UUID kidId : pickup.kidIds()) {
                String display = names.getOrDefault(kidId, "Kid");
                byKid.putIfAbsent(
                        kidId, new RidePlaylistAttendingKid(kidId, display, inviteLabel));
            }
        }

        return List.copyOf(byKid.values());
    }

    private List<CalendarRoutePickupInput> pickupsForDriver(
            UUID drivingAdultId, List<CarpoolAcceptedPickupDto> acceptedPickups) {
        List<CalendarRoutePickupInput> pickups = new ArrayList<>();
        Set<UUID> circleIds =
                acceptedPickups.stream()
                        .filter(p -> drivingAdultId.equals(p.acceptedByAdultId()))
                        .map(CarpoolAcceptedPickupDto::requestingCircleId)
                        .collect(Collectors.toCollection(HashSet::new));
        Map<UUID, String> names = new HashMap<>();
        for (FamilyCircleName row : familyMembershipApi.findCircles(circleIds)) {
            names.put(row.id(), row.name());
        }
        for (CarpoolAcceptedPickupDto pickup : acceptedPickups) {
            if (!drivingAdultId.equals(pickup.acceptedByAdultId())) {
                continue;
            }
            String to = names.get(pickup.requestingCircleId());
            if (to == null || to.isBlank()) {
                to = pickup.pickupPlaceName();
            }
            if (to == null || to.isBlank()) {
                to = "Family";
            }
            pickups.add(
                    new CalendarRoutePickupInput(
                            pickup.pickupPlaceName(),
                            pickup.pickupAddress(),
                            new CalendarRouteNotifyContact(CalendarRouteNotifyChannel.PUSH, to)));
        }
        return pickups;
    }

    private ItemSnapshot requireItemSnapshot(
            UUID circleId, CalendarItemSource source, UUID itemId) {
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
                yield new ItemSnapshot(event.title(), event.location(), event.kidIds());
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
                yield new ItemSnapshot(event.title(), event.location(), event.kidIds());
            }
        };
    }

    private static String destinationName(ItemSnapshot item) {
        if (item.location() != null && !item.location().isBlank()) {
            return item.location();
        }
        return item.title();
    }

    private static CalendarRouteResponse toRouteResponse(CalendarRouteDto route) {
        List<CalendarRouteStopResponse> stops =
                route.stops().stream()
                        .map(
                                stop ->
                                        new CalendarRouteStopResponse(
                                                stop.name(),
                                                stop.address(),
                                                stop.kind(),
                                                stop.contact() == null
                                                        ? null
                                                        : new CalendarRouteNotifyContactResponse(
                                                                stop.contact().channel(),
                                                                stop.contact().to())))
                        .toList();
        return new CalendarRouteResponse(
                route.status(),
                route.reason(),
                route.bufferMinutes(),
                stops,
                route.legMinutes());
    }

    private record ItemSnapshot(String title, String location, List<UUID> kidIds) {}
}
