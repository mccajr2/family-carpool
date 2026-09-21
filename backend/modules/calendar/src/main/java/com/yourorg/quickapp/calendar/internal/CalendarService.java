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
import com.yourorg.quickapp.calendar.CalendarRouteMemberItemResponse;
import com.yourorg.quickapp.calendar.CalendarRouteNotifyContactResponse;
import com.yourorg.quickapp.calendar.CalendarRouteResponse;
import com.yourorg.quickapp.calendar.CalendarRouteStopResponse;
import com.yourorg.quickapp.calendar.CalendarRsvpResponse;
import com.yourorg.quickapp.calendar.ClearDriveBlockOverrideRequest;
import com.yourorg.quickapp.calendar.SetDriveBlockOverrideRequest;
import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolHouseholdStopDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.coverage.ScheduleIntervals;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.events.ManualEventKey;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.leaveby.CalendarRouteDto;
import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.CalendarRouteMemberRef;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveFromEnrichmentInput;
import com.yourorg.quickapp.leaveby.LeaveFromPlaceDto;
import com.yourorg.quickapp.playlist.RidePlaylistApi;
import com.yourorg.quickapp.playlist.RidePlaylistAttendingKid;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
    private final DriveBlockEnricher driveBlockEnricher;
    private final DriveBlockOverrideService driveBlockOverrideService;
    private final DriveBlockRouteResolver driveBlockRouteResolver;
    private final FamilyPlaceApi familyPlaceApi;

    public CalendarService(
            FamilyMembershipApi familyMembershipApi,
            FeedCalendarApi feedCalendarApi,
            ManualEventCalendarApi manualEventCalendarApi,
            LeaveByApi leaveByApi,
            CoverageApi coverageApi,
            RsvpApi rsvpApi,
            AdultSessionApi adultSessionApi,
            CarpoolApi carpoolApi,
            RidePlaylistApi ridePlaylistApi,
            DriveBlockEnricher driveBlockEnricher,
            DriveBlockOverrideService driveBlockOverrideService,
            DriveBlockRouteResolver driveBlockRouteResolver,
            FamilyPlaceApi familyPlaceApi) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedCalendarApi = feedCalendarApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.leaveByApi = leaveByApi;
        this.coverageApi = coverageApi;
        this.rsvpApi = rsvpApi;
        this.adultSessionApi = adultSessionApi;
        this.carpoolApi = carpoolApi;
        this.ridePlaylistApi = ridePlaylistApi;
        this.driveBlockEnricher = driveBlockEnricher;
        this.driveBlockOverrideService = driveBlockOverrideService;
        this.driveBlockRouteResolver = driveBlockRouteResolver;
        this.familyPlaceApi = familyPlaceApi;
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
        return driveBlockEnricher.attach(adult.id(), circleId, List.copyOf(items));
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
        return getRoute(adult, source, itemId, CalendarRouteLeg.TO);
    }

    @Transactional
    public CalendarRouteResponse getRoute(
            AdultResponse adult, CalendarItemSource source, UUID itemId, CalendarRouteLeg leg) {
        CalendarRouteLeg safeLeg = leg == null ? CalendarRouteLeg.TO : leg;
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        RouteBlockContext context = requireRoutableBlock(adult, circleId, source, itemId, safeLeg);
        CalendarRouteDto route =
                leaveByApi.getOrRefreshCalendarRoute(
                        context.drivingAdultId(),
                        safeLeg,
                        context.members(),
                        context.originSource(),
                        context.originItemId(),
                        context.eventTitle(),
                        context.middles(),
                        context.venueName(),
                        context.venueAddress());
        return toRouteResponse(route);
    }

    @Transactional
    public CalendarRouteResponse reorderRoute(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            List<String> middleStopIds) {
        return reorderRoute(adult, source, itemId, middleStopIds, CalendarRouteLeg.TO);
    }

    @Transactional
    public CalendarRouteResponse reorderRoute(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            List<String> middleStopIds,
            CalendarRouteLeg leg) {
        CalendarRouteLeg safeLeg = leg == null ? CalendarRouteLeg.TO : leg;
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        RouteBlockContext context = requireRoutableBlock(adult, circleId, source, itemId, safeLeg);
        if (!adult.id().equals(context.drivingAdultId())) {
            throw new CalendarException(
                    HttpStatus.FORBIDDEN, "Only the driving adult may reorder the route");
        }
        CalendarRouteDto route =
                leaveByApi.reorderCalendarRouteMiddles(
                        context.drivingAdultId(), safeLeg, context.members(), middleStopIds);
        return toRouteResponse(route);
    }

    @Transactional
    public CalendarRouteResponse setRouteOrigin(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            CalendarRouteLeg leg,
            UUID homePlaceId,
            String homeAddress) {
        CalendarRouteLeg safeLeg = leg == null ? CalendarRouteLeg.TO : leg;
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        RouteBlockContext context = requireRoutableBlock(adult, circleId, source, itemId, safeLeg);
        if (!adult.id().equals(context.drivingAdultId())) {
            throw new CalendarException(
                    HttpStatus.FORBIDDEN, "Only the driving adult may set the route origin");
        }
        CalendarRouteDto route =
                leaveByApi.setCalendarRouteOrigin(
                        context.drivingAdultId(),
                        safeLeg,
                        context.members(),
                        context.originSource(),
                        context.originItemId(),
                        context.eventTitle(),
                        context.middles(),
                        context.venueName(),
                        context.venueAddress(),
                        homePlaceId,
                        homeAddress);
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
            if (carpoolEligibleItem(circleId, source, itemId)
                    && !hasConfirmedCoverage(circleId, coverageSource, itemId)) {
                carpoolApi.withdrawAcceptedInboundForFeedEvent(adult.id(), itemId);
            }
        }
        if (status == RsvpStatus.NO && carpoolEligibleItem(circleId, source, itemId)) {
            carpoolApi.clearTransportForNotGoingKid(adult.id(), itemId, kidId);
        }
        rsvpApi.setStatus(
                circleId, toRsvpSource(source), itemId, kidId, status, adult.id());
        return requireItem(adult.id(), circleId, source, itemId);
    }

    /**
     * Persist FORCE_MERGE / FORCE_SPLIT for the viewing adult on an ordered
     * pair, then return both items re-enriched (drive-block links included).
     */
    @Transactional
    public List<CalendarItemResponse> setDriveBlockOverride(
            AdultResponse adult, SetDriveBlockOverrideRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        OrderedPair pair =
                requireOrderedPair(
                        circleId,
                        request.leg(),
                        request.leftSource(),
                        request.leftItemId(),
                        request.rightSource(),
                        request.rightItemId());
        driveBlockOverrideService.upsert(
                adult.id(),
                pair.leg(),
                pair.leftSource(),
                pair.leftItemId(),
                pair.rightSource(),
                pair.rightItemId(),
                request.action());
        return enrichDriveBlockPair(adult.id(), circleId, pair);
    }

    /**
     * Clear a pair override for the viewing adult (restore auto merge). Returns
     * both items re-enriched even when nothing was stored.
     */
    @Transactional
    public List<CalendarItemResponse> clearDriveBlockOverride(
            AdultResponse adult, ClearDriveBlockOverrideRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        OrderedPair pair =
                requireOrderedPair(
                        circleId,
                        request.leg(),
                        request.leftSource(),
                        request.leftItemId(),
                        request.rightSource(),
                        request.rightItemId());
        driveBlockOverrideService.clear(
                adult.id(),
                pair.leg(),
                pair.leftSource(),
                pair.leftItemId(),
                pair.rightSource(),
                pair.rightItemId());
        return enrichDriveBlockPair(adult.id(), circleId, pair);
    }

    /**
     * Re-attach drive-block links with both pair members in one pass so
     * back-to-back (non-overlapping) siblings still get adjacency — single-item
     * enrich alone can miss them.
     */
    private List<CalendarItemResponse> enrichDriveBlockPair(
            UUID adultId, UUID circleId, OrderedPair pair) {
        List<CalendarItemResponse> both =
                List.of(
                        requireItem(adultId, circleId, pair.leftSource(), pair.leftItemId()),
                        requireItem(adultId, circleId, pair.rightSource(), pair.rightItemId()));
        return driveBlockEnricher.attach(adultId, circleId, both);
    }

    private OrderedPair requireOrderedPair(
            UUID circleId,
            CarpoolLegKind leg,
            CalendarItemSource leftSource,
            UUID leftItemId,
            CalendarItemSource rightSource,
            UUID rightItemId) {
        if (leg == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "leg is required");
        }
        Instant leftStarts = requireItemStartsAt(circleId, leftSource, leftItemId);
        Instant rightStarts = requireItemStartsAt(circleId, rightSource, rightItemId);
        if (leftSource == rightSource && leftItemId.equals(rightItemId)) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST, "left and right items must be distinct");
        }
        int cmp = leftStarts.compareTo(rightStarts);
        if (cmp < 0 || (cmp == 0 && leftItemId.toString().compareTo(rightItemId.toString()) <= 0)) {
            return new OrderedPair(leg, leftSource, leftItemId, rightSource, rightItemId);
        }
        return new OrderedPair(leg, rightSource, rightItemId, leftSource, leftItemId);
    }

    private Instant requireItemStartsAt(
            UUID circleId, CalendarItemSource source, UUID itemId) {
        if (source == null || itemId == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "item refs are required");
        }
        return switch (source) {
            case MANUAL ->
                    manualEventCalendarApi
                            .findInCircle(circleId, itemId)
                            .orElseThrow(
                                    () ->
                                            new CalendarException(
                                                    HttpStatus.NOT_FOUND,
                                                    "Calendar item not found"))
                            .startsAt();
            case FEED ->
                    feedCalendarApi
                            .findEventInCircle(circleId, itemId)
                            .orElseThrow(
                                    () ->
                                            new CalendarException(
                                                    HttpStatus.NOT_FOUND,
                                                    "Calendar item not found"))
                            .startsAt();
        };
    }

    private record OrderedPair(
            CarpoolLegKind leg,
            CalendarItemSource leftSource,
            UUID leftItemId,
            CalendarItemSource rightSource,
            UUID rightItemId) {}

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
            CalendarItemResponse item =
                    fromManual(
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
            return driveBlockEnricher.attach(adultId, circleId, List.of(item)).getFirst();
        }
        // Widen past half-open overlap so back-to-back (0-gap) siblings still
        // appear for drive-block adjacency on single-item mutation responses.
        Instant windowStart = feed.startsAt().minus(4, ChronoUnit.HOURS);
        Instant windowEnd =
                ScheduleIntervals.endExclusive(feed.startsAt(), feed.endsAt())
                        .plus(4, ChronoUnit.HOURS);
        List<FeedCalendarEventDto> nearbyFeeds = new ArrayList<>();
        nearbyFeeds.add(feed);
        for (FeedCalendarEventDto nearby :
                feedCalendarApi.listEventsOverlapping(circleId, windowStart, windowEnd)) {
            if (!nearby.id().equals(feed.id())) {
                nearbyFeeds.add(nearby);
            }
        }
        Map<UUID, List<CoverageAssignmentDto>> nearbyCoverages =
                groupCoverages(
                        coverageApi.listForItems(
                                circleId,
                                CoverageItemSource.FEED,
                                nearbyFeeds.stream().map(FeedCalendarEventDto::id).toList()));
        Map<UUID, List<RsvpDto>> nearbyRsvps =
                groupRsvps(
                        rsvpApi.listForItems(
                                circleId,
                                RsvpItemSource.FEED,
                                nearbyFeeds.stream().map(FeedCalendarEventDto::id).toList()));
        Map<UUID, String> adultNames = displayNamesFor(nearbyCoverages, Map.of());
        Map<ItemLeaveMetaKey, ItemLeaveMeta> itemMeta = new HashMap<>();
        for (FeedCalendarEventDto nearby : nearbyFeeds) {
            itemMeta.put(
                    new ItemLeaveMetaKey(CoverageItemSource.FEED, nearby.id()),
                    new ItemLeaveMeta(nearby.startsAt(), nearby.location()));
        }
        Map<UUID, LeaveByEnrichmentDto> coverageLeaveBys =
                enrichCoverageLeaveBys(flattenCoverages(nearbyCoverages, Map.of()), itemMeta, true);
        List<LeaveByItemInput> leaveInputs = new ArrayList<>();
        for (FeedCalendarEventDto nearby : nearbyFeeds) {
            leaveInputs.add(
                    new LeaveByItemInput(
                            LeaveByItemSource.FEED,
                            nearby.id(),
                            nearby.startsAt(),
                            nearby.location()));
        }
        List<LeaveByEnrichmentDto> leaveBys = leaveByApi.enrichMany(adultId, leaveInputs);
        List<CalendarItemResponse> nearbyItems = new ArrayList<>();
        for (int i = 0; i < nearbyFeeds.size(); i++) {
            FeedCalendarEventDto nearby = nearbyFeeds.get(i);
            nearbyItems.add(
                    fromFeed(
                            nearby,
                            nearbyCoverages.getOrDefault(nearby.id(), List.of()),
                            nearbyRsvps.getOrDefault(nearby.id(), List.of()),
                            adultNames,
                            conflictsByItem.getOrDefault(
                                    new CalendarConflictDetector.ItemKey(
                                            CalendarItemSource.FEED, nearby.id()),
                                    List.of()),
                            leaveBys.get(i),
                            coverageLeaveBys));
        }
        List<CalendarItemResponse> enriched =
                driveBlockEnricher.attach(adultId, circleId, nearbyItems);
        return enriched.stream()
                .filter(item -> item.id().equals(feed.id()))
                .findFirst()
                .orElseThrow(
                        () ->
                                new CalendarException(
                                        HttpStatus.NOT_FOUND, "Calendar item not found"));
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
                            inPlayKidIds(base.source(), base.kidIds(), rsvps),
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
        UUID feedId = event.feedId();
        String feedName = feedId == null ? null : event.feedName();
        String eventKey = feedId == null ? null : ManualEventKey.of(event.id());
        return toResponse(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                feedId,
                feedName,
                eventKey,
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
                uncoveredKidIds(source, kidIds, coverages, rsvps),
                conflicts == null ? List.of() : List.copyOf(conflicts),
                rsvpResponses,
                List.of());
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
        return uncoveredKidIds(CalendarItemSource.FEED, kidIds, coverages, rsvps);
    }

    static List<UUID> uncoveredKidIds(
            CalendarItemSource source,
            List<UUID> kidIds,
            List<CoverageAssignmentDto> coverages,
            List<RsvpDto> rsvps) {
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
                .filter(id -> isGoingForCoverage(source, byKid.getOrDefault(id, RsvpStatus.NO_RESPONSE)))
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
        return inPlayKidIds(CalendarItemSource.FEED, kidIds, rsvps);
    }

    static List<UUID> inPlayKidIds(
            CalendarItemSource source, List<UUID> kidIds, List<RsvpDto> rsvps) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, RsvpStatus> byKid = statusByKid(rsvps);
        return kidIds.stream()
                .filter(id -> isGoingForCoverage(source, byKid.getOrDefault(id, RsvpStatus.NO_RESPONSE)))
                .toList();
    }

    /**
     * FEED (ADR-0003): missing / {@code NO_RESPONSE} counts as going. MANUAL is
     * opt-in: only explicit {@code YES} counts as going.
     */
    static boolean isGoingForCoverage(CalendarItemSource source, RsvpStatus status) {
        if (source == CalendarItemSource.MANUAL) {
            return status == RsvpStatus.YES;
        }
        return status != RsvpStatus.NO;
    }

    private boolean carpoolEligibleItem(
            UUID circleId, CalendarItemSource source, UUID itemId) {
        return switch (source) {
            case FEED -> true;
            case MANUAL ->
                    manualEventCalendarApi
                            .findInCircle(circleId, itemId)
                            .map(manual -> manual.feedId() != null)
                            .orElse(false);
        };
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

    private RouteBlockContext requireRoutableBlock(
            AdultResponse adult,
            UUID circleId,
            CalendarItemSource source,
            UUID itemId,
            CalendarRouteLeg leg) {
        CarpoolLegKind carpoolLeg =
                leg == CalendarRouteLeg.FROM ? CarpoolLegKind.FROM : CarpoolLegKind.TO;
        RichItemSnapshot pathItem = requireRichItemSnapshot(circleId, source, itemId);

        // Routability gate (caller may view): same as single-event — confirmed
        // household driver or ACCEPTED teammate circle for an in-play kid.
        List<CoverageAssignmentDto> pathCoverages =
                coverageApi.listForItem(circleId, toCoverageSource(source), itemId);
        List<RsvpDto> pathRsvps =
                rsvpApi.listForItems(circleId, toRsvpSource(source), List.of(itemId));
        List<CarpoolAcceptedPickupDto> pathPickups =
                source == CalendarItemSource.FEED
                        ? carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                                circleId, itemId, carpoolLeg)
                        : List.of();
        // Also check TO pickups so FROM viewers on an ACCEPTED ride still pass.
        if (pathPickups.isEmpty() && source == CalendarItemSource.FEED) {
            pathPickups = carpoolApi.listAcceptedPickupsForFeedEvent(circleId, itemId);
        }
        UUID drivingAdultId =
                resolveDrivingAdultId(
                                adult.id(),
                                circleId,
                                pathItem.kidIds(),
                                pathCoverages,
                                pathRsvps,
                                pathPickups)
                        .orElseThrow(
                                () ->
                                        new CalendarException(
                                                HttpStatus.FORBIDDEN,
                                                "Not allowed to route this calendar item"));

        List<CalendarItemResponse> windowItems =
                routeWindowItems(drivingAdultId, circleId, pathItem);
        DrivingBlockComputer.DriveBlock block =
                driveBlockRouteResolver
                        .resolve(
                                drivingAdultId, circleId, source, itemId, carpoolLeg, windowItems)
                        .orElseGet(
                                () ->
                                        new DrivingBlockComputer.DriveBlock(
                                                carpoolLeg,
                                                List.of(
                                                        new DrivingBlockComputer.ItemRef(
                                                                source, itemId))));

        // Viewer must be driving adult on this leg when the block is combined /
        // FROM-only without teammate path — fall back: if block resolve found
        // nothing for FROM and driving adult isn't confirmed on FROM, 403.
        if (carpoolLeg == CarpoolLegKind.FROM
                && block.items().size() == 1
                && source == CalendarItemSource.FEED) {
            boolean confirmedFrom =
                    carpoolApi
                            .listConfirmedDrivingLegs(
                                    drivingAdultId, circleId, List.of(itemId))
                            .stream()
                            .anyMatch(row -> row.leg() == CarpoolLegKind.FROM);
            if (!confirmedFrom) {
                throw new CalendarException(
                        HttpStatus.FORBIDDEN, "Not allowed to route this calendar item");
            }
        }

        List<RichItemSnapshot> memberSnapshots = new ArrayList<>();
        List<CalendarRouteMemberRef> members = new ArrayList<>();
        for (DrivingBlockComputer.ItemRef ref : block.items()) {
            RichItemSnapshot snap = requireRichItemSnapshot(circleId, ref.source(), ref.id());
            memberSnapshots.add(snap);
            members.add(new CalendarRouteMemberRef(toLeaveBySource(ref.source()), ref.id()));
        }
        RichItemSnapshot earliest =
                memberSnapshots.stream()
                        .min(Comparator.comparing(RichItemSnapshot::startsAt)
                                .thenComparing(s -> s.id().toString()))
                        .orElse(pathItem);

        // Combined HOME is membership default (leaveby); earliest only drives
        // leave-by title buffer + shared venue identity on the path args.
        String homeAddress = resolveDriverHomeAddress(drivingAdultId);
        List<CalendarRoutePickupInput> middles =
                assembleMiddles(
                        drivingAdultId,
                        circleId,
                        carpoolLeg,
                        memberSnapshots,
                        homeAddress,
                        members.size() > 1);

        return new RouteBlockContext(
                drivingAdultId,
                List.copyOf(members),
                toLeaveBySource(earliest.source()),
                earliest.id(),
                earliest.title(),
                List.copyOf(middles),
                destinationName(earliest),
                earliest.location());
    }

    private List<CalendarItemResponse> routeWindowItems(
            UUID adultId, UUID circleId, RichItemSnapshot pathItem) {
        if (pathItem.source() != CalendarItemSource.FEED) {
            return List.of();
        }
        Instant from = DriveBlockRouteResolver.windowFrom(pathItem.startsAt());
        Instant to = DriveBlockRouteResolver.windowTo(pathItem.startsAt());
        List<FeedCalendarEventDto> feedEvents =
                feedCalendarApi.listEventsInRange(circleId, from, to);
        Map<UUID, List<CoverageAssignmentDto>> coverages =
                groupCoverages(
                        coverageApi.listForItems(
                                circleId,
                                CoverageItemSource.FEED,
                                feedEvents.stream().map(FeedCalendarEventDto::id).toList()));
        List<CalendarItemResponse> items = new ArrayList<>();
        for (FeedCalendarEventDto event : feedEvents) {
            items.add(lightweightFeedItem(event, coverages.getOrDefault(event.id(), List.of())));
        }
        return items;
    }

    private static CalendarItemResponse lightweightFeedItem(
            FeedCalendarEventDto event, List<CoverageAssignmentDto> coverages) {
        List<CalendarCoverageAssignmentResponse> coverageResponses =
                coverages.stream()
                        .map(
                                c ->
                                        new CalendarCoverageAssignmentResponse(
                                                c.id(),
                                                c.coveringAdultId(),
                                                "",
                                                c.assignedByAdultId(),
                                                c.kidIds(),
                                                c.status(),
                                                c.leaveFromPlaceId(),
                                                null,
                                                c.leaveFromAddress(),
                                                null,
                                                null,
                                                null))
                        .toList();
        return new CalendarItemResponse(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                event.feedId(),
                null,
                FeedEventKey.of(event),
                null,
                null,
                null,
                null,
                null,
                null,
                coverageResponses,
                List.of(),
                List.of(),
                List.of(),
                List.of());
    }

    private List<CalendarRoutePickupInput> assembleMiddles(
            UUID drivingAdultId,
            UUID circleId,
            CarpoolLegKind leg,
            List<RichItemSnapshot> members,
            String homeAddress,
            boolean combinedBlock) {
        CalendarRouteStopKind middleKind =
                leg == CarpoolLegKind.FROM
                        ? CalendarRouteStopKind.DROPOFF
                        : CalendarRouteStopKind.PICKUP;
        List<CalendarRoutePickupInput> raw = new ArrayList<>();

        if (combinedBlock && leg == CarpoolLegKind.TO) {
            for (RichItemSnapshot member : members) {
                raw.addAll(
                        householdLeaveFromMiddles(
                                drivingAdultId, circleId, member, homeAddress, middleKind));
            }
        }

        for (RichItemSnapshot member : members) {
            if (member.source() != CalendarItemSource.FEED) {
                continue;
            }
            if (combinedBlock) {
                raw.addAll(
                        householdPlanMiddles(
                                drivingAdultId, circleId, member.id(), leg, middleKind));
            }
            List<CarpoolAcceptedPickupDto> stops =
                    carpoolApi.listAcceptedFamilyStopsForFeedEvent(circleId, member.id(), leg);
            raw.addAll(familyStopsForDriver(drivingAdultId, stops, middleKind));
        }

        List<CalendarRoutePickupInput> withoutHome =
                BlockRouteAssembler.withoutAddress(raw, homeAddress);
        return BlockRouteAssembler.mergeColocated(withoutHome);
    }

    private List<CalendarRoutePickupInput> householdPlanMiddles(
            UUID drivingAdultId,
            UUID circleId,
            UUID feedEventId,
            CarpoolLegKind leg,
            CalendarRouteStopKind kind) {
        List<CarpoolHouseholdStopDto> stops =
                carpoolApi.listConfirmedHouseholdStopsForFeedEvent(
                        drivingAdultId, circleId, feedEventId, leg);
        if (stops.isEmpty()) {
            return List.of();
        }
        List<CalendarRoutePickupInput> out = new ArrayList<>();
        for (CarpoolHouseholdStopDto stop : stops) {
            if (stop.placeAddress() == null || stop.placeAddress().isBlank()) {
                continue;
            }
            String label =
                    stop.placeName() == null || stop.placeName().isBlank()
                            ? stop.placeAddress()
                            : stop.placeName();
            Set<UUID> kidIds =
                    stop.kidIds() == null ? Set.of() : new HashSet<>(stop.kidIds());
            if (!kidIds.isEmpty()) {
                Map<UUID, String> names = new HashMap<>();
                for (FamilyKidName kid : familyMembershipApi.findKids(circleId, kidIds)) {
                    names.put(kid.id(), kid.displayName());
                }
                if (!names.isEmpty()) {
                    String kidLabel = String.join(" and ", names.values());
                    if (!kidLabel.isBlank()
                            && !label.toLowerCase().contains(kidLabel.toLowerCase())) {
                        label = kidLabel + " · " + label;
                    }
                }
            }
            out.add(new CalendarRoutePickupInput(label, stop.placeAddress(), null, kind));
        }
        return out;
    }

    private List<CalendarRoutePickupInput> householdLeaveFromMiddles(
            UUID drivingAdultId,
            UUID circleId,
            RichItemSnapshot member,
            String homeAddress,
            CalendarRouteStopKind kind) {
        Optional<LeaveFromPlaceDto> pickup =
                leaveByApi.pickupLeaveFromForRouteMiddle(
                        drivingAdultId, toLeaveBySource(member.source()), member.id());
        if (pickup.isEmpty()
                || pickup.get().address() == null
                || pickup.get().address().isBlank()) {
            return List.of();
        }
        if (BlockRouteAssembler.normalize(pickup.get().address())
                .equals(BlockRouteAssembler.normalize(homeAddress))) {
            return List.of();
        }

        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(
                        circleId, toCoverageSource(member.source()), member.id());
        Set<UUID> kidIds = new HashSet<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() != CoverageStatus.CONFIRMED) {
                continue;
            }
            if (!drivingAdultId.equals(coverage.coveringAdultId())) {
                continue;
            }
            kidIds.addAll(coverage.kidIds());
        }
        if (kidIds.isEmpty() && member.kidIds() != null) {
            kidIds.addAll(member.kidIds());
        }

        LeaveFromPlaceDto place = pickup.get();
        String label =
                place.placeName() == null || place.placeName().isBlank()
                        ? place.address()
                        : place.placeName();
        if (!kidIds.isEmpty()) {
            Map<UUID, String> names = new HashMap<>();
            for (FamilyKidName kid : familyMembershipApi.findKids(circleId, kidIds)) {
                names.put(kid.id(), kid.displayName());
            }
            if (!names.isEmpty()) {
                String kidLabel = String.join(" and ", names.values());
                if (!kidLabel.isBlank()) {
                    label = kidLabel + " · " + label;
                }
            }
        }
        return List.of(new CalendarRoutePickupInput(label, place.address(), null, kind));
    }

    private ResolvedLeaveFromPlace resolveCoverageLeaveFrom(
            UUID adultId, CoverageAssignmentDto coverage) {
        if (coverage.leaveFromAddress() != null && !coverage.leaveFromAddress().isBlank()) {
            return new ResolvedLeaveFromPlace(null, coverage.leaveFromAddress());
        }
        if (coverage.leaveFromPlaceId() != null) {
            Optional<CirclePlaceDto> place =
                    familyPlaceApi.findPlaceForMember(adultId, coverage.leaveFromPlaceId());
            if (place.isPresent()) {
                return new ResolvedLeaveFromPlace(place.get().name(), place.get().address());
            }
        }
        return new ResolvedLeaveFromPlace(null, null);
    }

    private String resolveDriverHomeAddress(UUID drivingAdultId) {
        Optional<CirclePlaceDto> home = familyPlaceApi.findDefaultLeaveFromForMember(drivingAdultId);
        if (home.isPresent() && home.get().address() != null && !home.get().address().isBlank()) {
            return home.get().address();
        }
        return familyPlaceApi.listLocatedPlacesForMember(drivingAdultId).stream()
                .filter(p -> p.address() != null && !p.address().isBlank())
                .map(CirclePlaceDto::address)
                .findFirst()
                .orElse("");
    }

    private List<CalendarRoutePickupInput> familyStopsForDriver(
            UUID drivingAdultId,
            List<CarpoolAcceptedPickupDto> acceptedStops,
            CalendarRouteStopKind kind) {
        List<CalendarRoutePickupInput> stops = new ArrayList<>();
        Set<UUID> circleIds =
                acceptedStops.stream()
                        .filter(p -> drivingAdultId.equals(p.acceptedByAdultId()))
                        .map(CarpoolAcceptedPickupDto::requestingCircleId)
                        .collect(Collectors.toCollection(HashSet::new));
        Map<UUID, String> names = new HashMap<>();
        for (FamilyCircleName row : familyMembershipApi.findCircles(circleIds)) {
            names.put(row.id(), row.name());
        }
        for (CarpoolAcceptedPickupDto pickup : acceptedStops) {
            if (!drivingAdultId.equals(pickup.acceptedByAdultId())) {
                continue;
            }
            if (pickup.pickupAddress() == null || pickup.pickupAddress().isBlank()) {
                continue;
            }
            String to = names.get(pickup.requestingCircleId());
            if (to == null || to.isBlank()) {
                to = pickup.pickupPlaceName();
            }
            if (to == null || to.isBlank()) {
                to = "Family";
            }
            String stopName =
                    pickup.pickupPlaceName() == null || pickup.pickupPlaceName().isBlank()
                            ? pickup.pickupAddress()
                            : pickup.pickupPlaceName();
            // ADR-0004 rule 5: qualify teammate stop with whose place it is.
            if (!stopName.toLowerCase().contains(to.toLowerCase())) {
                stopName = stopName + " (" + to + ")";
            }
            stops.add(
                    new CalendarRoutePickupInput(
                            stopName,
                            pickup.pickupAddress(),
                            new CalendarRouteNotifyContact(CalendarRouteNotifyChannel.PUSH, to),
                            kind));
        }
        return stops;
    }

    private List<CalendarRoutePickupInput> pickupsForDriver(
            UUID drivingAdultId, List<CarpoolAcceptedPickupDto> acceptedPickups) {
        return familyStopsForDriver(
                drivingAdultId, acceptedPickups, CalendarRouteStopKind.PICKUP);
    }

    private ItemSnapshot requireItemSnapshot(
            UUID circleId, CalendarItemSource source, UUID itemId) {
        RichItemSnapshot rich = requireRichItemSnapshot(circleId, source, itemId);
        return new ItemSnapshot(rich.title(), rich.location(), rich.kidIds());
    }

    private RichItemSnapshot requireRichItemSnapshot(
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
                yield new RichItemSnapshot(
                        event.id(),
                        CalendarItemSource.MANUAL,
                        event.title(),
                        event.location(),
                        event.kidIds(),
                        event.startsAt(),
                        event.endsAt());
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
                yield new RichItemSnapshot(
                        event.id(),
                        CalendarItemSource.FEED,
                        event.title(),
                        event.location(),
                        event.kidIds(),
                        event.startsAt(),
                        event.endsAt());
            }
        };
    }

    private static String destinationName(ItemSnapshot item) {
        if (item.location() != null && !item.location().isBlank()) {
            return item.location();
        }
        return item.title();
    }

    private static String destinationName(RichItemSnapshot item) {
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
        List<CalendarRouteMemberItemResponse> members =
                route.memberItemIds() == null
                        ? List.of()
                        : route.memberItemIds().stream()
                                .map(
                                        m ->
                                                new CalendarRouteMemberItemResponse(
                                                        toCalendarSource(m.source()), m.itemId()))
                                .toList();
        return new CalendarRouteResponse(
                route.status(),
                route.reason(),
                route.bufferMinutes(),
                stops,
                route.legMinutes(),
                route.leg(),
                members,
                route.leaveFromPlaceId(),
                route.leaveFromPlaceName(),
                route.leaveFromAddress());
    }

    private static CalendarItemSource toCalendarSource(LeaveByItemSource source) {
        return switch (source) {
            case MANUAL -> CalendarItemSource.MANUAL;
            case FEED -> CalendarItemSource.FEED;
        };
    }

    private record ItemSnapshot(String title, String location, List<UUID> kidIds) {}

    private record RichItemSnapshot(
            UUID id,
            CalendarItemSource source,
            String title,
            String location,
            List<UUID> kidIds,
            Instant startsAt,
            Instant endsAt) {}

    private record RouteBlockContext(
            UUID drivingAdultId,
            List<CalendarRouteMemberRef> members,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
            String venueName,
            String venueAddress) {}

    private record ResolvedLeaveFromPlace(String name, String address) {}
}
