package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.carpool.CarpoolRideEventResponse;
import com.yourorg.quickapp.carpool.CarpoolRideLegResponse;
import com.yourorg.quickapp.carpool.CarpoolRideResponse;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import com.yourorg.quickapp.carpool.CreateCarpoolRideRequest;
import com.yourorg.quickapp.carpool.CarpoolRidePlanLegAction;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanGroup;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanLeg;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanRequest;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanResponse;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.DetourItemInput;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
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
public class CarpoolRideService {

    static final Instant EVENT_LOOKUP_FROM = Instant.parse("2000-01-01T00:00:00Z");
    static final Instant EVENT_LOOKUP_TO = Instant.parse("2100-01-01T00:00:00Z");
    private static final Duration MAX_WINDOW = Duration.ofDays(31);
    private static final int FAMILY_PLACE_ADDRESS_MAX = 255;
    /** Ride-level pickup label while TO meet side is ACCEPTOR and still pending. */
    private static final String DRIVER_PLACE_DISPLAY = "Driver's place";
    private static final List<CarpoolRideStatus> ACTIVE =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED);
    private static final List<CarpoolRideStatus> OWN_PLAN_STATUSES =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED, CarpoolRideStatus.PLAN);

    private final AdultSessionApi adultSessionApi;
    private final FamilyMembershipApi familyMembershipApi;
    private final FamilyPlaceApi familyPlaceApi;
    private final FeedsApi feedsApi;
    private final FeedCalendarApi feedCalendarApi;
    private final RsvpApi rsvpApi;
    private final LeaveByApi leaveByApi;
    private final CarpoolSpaceRepository spaces;
    private final CarpoolMembershipRepository memberships;
    private final CarpoolRideRequestRepository rides;
    private final CarpoolRidePassRepository passes;

    public CarpoolRideService(
            AdultSessionApi adultSessionApi,
            FamilyMembershipApi familyMembershipApi,
            FamilyPlaceApi familyPlaceApi,
            FeedsApi feedsApi,
            FeedCalendarApi feedCalendarApi,
            RsvpApi rsvpApi,
            LeaveByApi leaveByApi,
            CarpoolSpaceRepository spaces,
            CarpoolMembershipRepository memberships,
            CarpoolRideRequestRepository rides,
            CarpoolRidePassRepository passes) {
        this.adultSessionApi = adultSessionApi;
        this.familyMembershipApi = familyMembershipApi;
        this.familyPlaceApi = familyPlaceApi;
        this.feedsApi = feedsApi;
        this.feedCalendarApi = feedCalendarApi;
        this.rsvpApi = rsvpApi;
        this.leaveByApi = leaveByApi;
        this.spaces = spaces;
        this.memberships = memberships;
        this.rides = rides;
        this.passes = passes;
    }

    @Transactional(readOnly = true)
    public List<CarpoolRideEventResponse> list(
            AdultResponse adult, UUID spaceId, Instant from, Instant to) {
        requireValidRange(from, to);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        List<FeedCalendarEventDto> events = spaceEvents(circleId, space, from, to);
        if (events.isEmpty()) {
            return List.of();
        }
        Map<String, List<CarpoolRideRequestEntity>> ridesByKey =
                rides
                        .findBySpaceIdAndEventKeyInAndStatusIn(
                                spaceId,
                                events.stream().map(RideEventKey::of).distinct().toList(),
                                OWN_PLAN_STATUSES)
                        .stream()
                        .collect(Collectors.groupingBy(CarpoolRideRequestEntity::eventKey));
        Set<UUID> circleIds = new HashSet<>();
        for (List<CarpoolRideRequestEntity> group : ridesByKey.values()) {
            for (CarpoolRideRequestEntity ride : group) {
                circleIds.add(ride.requestingCircleId());
                if (ride.acceptingCircleId() != null) {
                    circleIds.add(ride.acceptingCircleId());
                }
            }
        }
        Map<UUID, String> circleNames = circleNames(circleIds);
        Set<UUID> listedRideIds =
                ridesByKey.values().stream()
                        .flatMap(List::stream)
                        .map(CarpoolRideRequestEntity::id)
                        .collect(Collectors.toSet());
        Map<UUID, List<CarpoolRidePassEntity>> passesByRide = passesByRideId(listedRideIds);
        Map<UUID, String> adultDisplayNames = adultDisplayNames(passesByRide.values());
        for (List<CarpoolRideRequestEntity> group : ridesByKey.values()) {
            for (CarpoolRideRequestEntity ride : group) {
                for (RideLegSlot leg : ride.legs()) {
                    if (leg.assigneeAdultId() != null
                            && !adultDisplayNames.containsKey(leg.assigneeAdultId())) {
                        adultDisplayNames.put(
                                leg.assigneeAdultId(),
                                adultSessionApi.requireAdult(leg.assigneeAdultId()).displayName());
                    }
                }
            }
        }
        Map<String, FeedCalendarEventDto> eventsByKey = new HashMap<>();
        for (FeedCalendarEventDto event : events) {
            eventsByKey.put(RideEventKey.of(event), event);
        }
        List<DetourItemInput> detourItems = new ArrayList<>();
        List<UUID> detourRideIds = new ArrayList<>();
        for (List<CarpoolRideRequestEntity> group : ridesByKey.values()) {
            for (CarpoolRideRequestEntity ride : group) {
                if (ride.requestingCircleId().equals(circleId)) {
                    continue;
                }
                if (!hasRequesterPickupStop(ride)) {
                    continue;
                }
                FeedCalendarEventDto event = eventsByKey.get(ride.eventKey());
                String eventLocation = event == null ? null : event.location();
                detourItems.add(
                        new DetourItemInput(
                                familySidePlaceAddress(ride, CarpoolLegKind.TO), eventLocation));
                detourRideIds.add(ride.id());
            }
        }
        Map<UUID, Integer> detourMinutesByRideId = detourMinutesByRideId(adult.id(), detourRideIds, detourItems);
        List<CarpoolRideEventResponse> result = new ArrayList<>();
        for (FeedCalendarEventDto event : events) {
            String eventKey = RideEventKey.of(event);
            List<CarpoolRideRequestEntity> overlay = ridesByKey.getOrDefault(eventKey, List.of());
            List<CarpoolRideResponse> ownRequests = new ArrayList<>();
            List<CarpoolRideRequestEntity> ownPlanRides = new ArrayList<>();
            List<CarpoolRideResponse> others = new ArrayList<>();
            for (CarpoolRideRequestEntity ride : overlay) {
                List<CarpoolRidePassEntity> ridePasses =
                        passesByRide.getOrDefault(ride.id(), List.of());
                boolean passedByMe =
                        !ride.requestingCircleId().equals(circleId)
                                && ridePasses.stream()
                                        .anyMatch(pass -> pass.adultId().equals(adult.id()));
                Integer detourMinutes =
                        ride.requestingCircleId().equals(circleId)
                                ? null
                                : detourMinutesByRideId.get(ride.id());
                CarpoolRideResponse dto =
                        toRideResponse(
                                ride,
                                circleNames,
                                passedByMe,
                                passedByAdultNames(ridePasses, adultDisplayNames),
                                detourMinutes,
                                adultDisplayNames);
                if (ride.requestingCircleId().equals(circleId)) {
                    if (ride.kids().isEmpty()) {
                        continue;
                    }
                    ownRequests.add(dto);
                    ownPlanRides.add(ride);
                } else if (ride.status() == CarpoolRideStatus.PENDING
                        || ride.status() == CarpoolRideStatus.ACCEPTED) {
                    others.add(dto);
                }
            }
            List<CarpoolRideLegResponse> ownLegs = singularOwnLegs(ownPlanRides, circleNames, adultDisplayNames);
            CarpoolRideResponse ownRequest = singularOwnRequest(ownRequests);
            UUID requestedBy =
                    ownPlanRides.isEmpty() ? null : ownPlanRides.getFirst().requestedByAdultId();
            String requestedByName =
                    requestedBy == null ? null : adultDisplayNames.get(requestedBy);
            if (requestedBy != null && requestedByName == null) {
                var requester = adultSessionApi.requireAdult(requestedBy);
                if (requester != null) {
                    requestedByName = requester.displayName();
                }
            }
            result.add(
                    new CarpoolRideEventResponse(
                            eventKey,
                            event.title(),
                            event.startsAt(),
                            event.endsAt(),
                            defaultKidIds(circleId, spaceId, event),
                            List.copyOf(ownRequests),
                            ownLegs,
                            ownRequest,
                            others,
                            requestedBy,
                            requestedByName));
        }
        return result;
    }

    @Transactional
    public CarpoolRideResponse create(
            AdultResponse adult, UUID spaceId, CreateCarpoolRideRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        FeedCalendarEventDto event =
                findSpaceEvent(circleId, space, request.eventKey())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST, "Unknown event"));
        String eventKey = RideEventKey.of(event);
        List<UUID> defaultKids = defaultKidIds(circleId, spaceId, event);
        List<UUID> kidIds = resolveCreateKids(request.kidIds(), defaultKids);
        List<CarpoolRideRequestEntity> existingPlans =
                findOwnActivePlans(spaceId, eventKey, circleId);
        for (CarpoolRideRequestEntity existingPlan : existingPlans) {
            if (existingPlan.status() == CarpoolRideStatus.PLAN) {
                existingPlan.cancel();
                rides.save(existingPlan);
            } else {
                throw new CarpoolException(
                        HttpStatus.CONFLICT,
                        "An active ride request from this circle already exists for this event");
            }
        }
        ResolvedFamilyPlace pickup =
                requireResolvedToPickup(adult.id(), null, null);
        List<FamilyKidName> names = familyMembershipApi.findKids(circleId, kidIds);
        if (names.size() != kidIds.size()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "Kid not found in this circle");
        }
        Map<UUID, String> byId =
                names.stream().collect(Collectors.toMap(FamilyKidName::id, FamilyKidName::displayName));
        List<RideKidSnapshot> snapshots = new ArrayList<>();
        for (UUID kidId : kidIds) {
            snapshots.add(new RideKidSnapshot(kidId, byId.get(kidId)));
        }
        Set<CarpoolLegKind> askedLegs = resolveCreateLegs(request.legs());
        CarpoolRideRequestEntity created =
                new CarpoolRideRequestEntity(
                        UUID.randomUUID(),
                        spaceId,
                        eventKey,
                        circleId,
                        adult.id(),
                        pickup.displayName(),
                        pickup.displayAddress(),
                        snapshots,
                        askedLegs,
                        Instant.now());
        // Create-ask has no per-leg place body yet: Default on both asked legs.
        for (RideLegSlot leg : created.legs()) {
            if (leg.phase() == CarpoolLegPhase.ASKED_TEAM) {
                applyDefaultFamilyPlace(leg, pickup);
            }
        }
        rides.save(created);
        return toRideResponse(
                created,
                circleNames(List.of(circleId)),
                false,
                List.of(),
                null,
                Map.of());
    }

    @Transactional
    public SaveCarpoolRidePlanResponse savePlan(
            AdultResponse adult, UUID spaceId, SaveCarpoolRidePlanRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        FeedCalendarEventDto event =
                findSpaceEvent(circleId, space, request.eventKey())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST, "Unknown event"));
        String eventKey = RideEventKey.of(event);
        List<UUID> goingKids = defaultKidIds(circleId, spaceId, event);
        List<MergedPlanGroup> groups =
                resolveMergedPlanGroups(request.plans(), adult.id(), circleId, goingKids, true);
        boolean anyAsk =
                groups.stream()
                        .flatMap(g -> g.legs().stream())
                        .anyMatch(leg -> leg.phase() == CarpoolLegPhase.ASKED_TEAM);
        ResolvedFamilyPlace toPickup = resolveToPickupFromGroups(groups, anyAsk);
        String pickupName = toPickup == null ? "Home" : toPickup.displayName();
        String pickupAddress = toPickup == null ? "" : toPickup.displayAddress();
        replaceOwnPlans(
                adult.id(),
                circleId,
                spaceId,
                eventKey,
                groups,
                pickupName,
                pickupAddress);
        return saveResponseForOwnPlans(
                findOwnActivePlans(spaceId, eventKey, circleId), circleId);
    }

    /**
     * Household-only Save ride plan when the feed has no carpool space yet.
     * Rejects ASK_TEAM. Persists PLAN row(s) with null space_id.
     */
    @Transactional
    public SaveCarpoolRidePlanResponse saveCirclePlan(
            AdultResponse adult, SaveCarpoolRidePlanRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        String eventKey = request.eventKey() == null ? "" : request.eventKey().trim();
        if (eventKey.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "eventKey is required");
        }
        List<MergedPlanGroup> groups =
                resolveMergedPlanGroups(request.plans(), adult.id(), circleId, null, false);
        boolean anyAsk =
                groups.stream()
                        .flatMap(g -> g.legs().stream())
                        .anyMatch(leg -> leg.phase() == CarpoolLegPhase.ASKED_TEAM);
        if (anyAsk) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "Ask the team requires an enabled carpool space");
        }
        ResolvedFamilyPlace toPickup = resolveToPickupFromGroups(groups, false);
        String pickupName = toPickup == null ? "Home" : toPickup.displayName();
        String pickupAddress = toPickup == null ? "" : toPickup.displayAddress();
        replaceOwnPlans(
                adult.id(),
                circleId,
                null,
                eventKey,
                groups,
                pickupName,
                pickupAddress);
        return saveResponseForOwnPlans(
                findOwnCircleLocalPlans(eventKey, circleId), circleId);
    }

    /**
     * Lists circle-local household plans (null space_id) as ride events for
     * Agenda join when Enable carpool has not created a space yet.
     */
    @Transactional(readOnly = true)
    public List<CarpoolRideEventResponse> listCirclePlans(AdultResponse adult) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        List<CarpoolRideRequestEntity> plans =
                rides.findByRequestingCircleIdAndSpaceIdIsNullAndStatusIn(
                        circleId, OWN_PLAN_STATUSES);
        Map<UUID, String> names = circleNames(List.of(circleId));
        Map<String, List<CarpoolRideRequestEntity>> byEvent = new HashMap<>();
        for (CarpoolRideRequestEntity ride : plans) {
            if (ride.kids().isEmpty()) {
                continue;
            }
            byEvent.computeIfAbsent(ride.eventKey(), key -> new ArrayList<>()).add(ride);
        }
        List<CarpoolRideEventResponse> result = new ArrayList<>();
        for (Map.Entry<String, List<CarpoolRideRequestEntity>> entry : byEvent.entrySet()) {
            List<CarpoolRideRequestEntity> eventPlans = entry.getValue();
            Map<UUID, String> assigneeNames = new HashMap<>();
            for (CarpoolRideRequestEntity ride : eventPlans) {
                assigneeNames.putAll(assigneeDisplayNames(ride));
            }
            List<CarpoolRideResponse> ownRequests = new ArrayList<>();
            for (CarpoolRideRequestEntity ride : eventPlans) {
                ownRequests.add(
                        toRideResponse(ride, names, false, List.of(), null, assigneeNames));
            }
            LinkedHashSet<UUID> defaultKids = new LinkedHashSet<>();
            for (CarpoolRideRequestEntity ride : eventPlans) {
                for (RideKidSnapshot kid : ride.kids()) {
                    defaultKids.add(kid.kidId());
                }
            }
            UUID requestedBy = eventPlans.getFirst().requestedByAdultId();
            String requesterName =
                    requestedBy == null
                            ? null
                            : adultSessionApi.requireAdult(requestedBy).displayName();
            result.add(
                    new CarpoolRideEventResponse(
                            entry.getKey(),
                            entry.getKey(),
                            Instant.EPOCH,
                            null,
                            List.copyOf(defaultKids),
                            List.copyOf(ownRequests),
                            singularOwnLegs(eventPlans, names, assigneeNames),
                            singularOwnRequest(ownRequests),
                            List.of(),
                            requestedBy,
                            requesterName));
        }
        return result;
    }

    /** Attach circle-local PLANs whose event keys belong to this feed onto the new space. */
    @Transactional
    public void attachCircleLocalPlansToSpace(UUID circleId, UUID spaceId, UUID feedId) {
        List<FeedCalendarEventDto> events =
                feedCalendarApi.listEventsInRange(circleId, EVENT_LOOKUP_FROM, EVENT_LOOKUP_TO);
        Set<String> feedKeys = new HashSet<>();
        for (FeedCalendarEventDto event : events) {
            if (feedId.equals(event.feedId())) {
                feedKeys.add(RideEventKey.of(event));
            }
        }
        if (feedKeys.isEmpty()) {
            return;
        }
        List<CarpoolRideRequestEntity> local =
                rides.findByRequestingCircleIdAndEventKeyInAndSpaceIdIsNullAndStatusIn(
                        circleId, feedKeys, OWN_PLAN_STATUSES);
        for (CarpoolRideRequestEntity ride : local) {
            ride.attachSpaceId(spaceId);
            rides.save(ride);
        }
    }

    public SaveCarpoolRidePlanResponse confirmCircleHouseholdPlan(
            AdultResponse adult, String eventKey) {
        return mutateCircleWaitingHousehold(adult, eventKey, true);
    }

    public SaveCarpoolRidePlanResponse declineCircleHouseholdPlan(
            AdultResponse adult, String eventKey) {
        return mutateCircleWaitingHousehold(adult, eventKey, false);
    }

    private SaveCarpoolRidePlanResponse mutateCircleWaitingHousehold(
            AdultResponse adult, String eventKey, boolean confirm) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        if (eventKey == null || eventKey.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "eventKey is required");
        }
        String key = eventKey.trim();
        List<CarpoolRideRequestEntity> plans = findOwnCircleLocalPlans(key, circleId);
        if (plans.isEmpty()) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "No active ride plan for this event");
        }
        int changed = 0;
        for (CarpoolRideRequestEntity ride : plans) {
            int rideChanged =
                    confirm
                            ? ride.confirmWaitingHouseholdFor(adult.id())
                            : ride.declineWaitingHouseholdFor(adult.id());
            if (rideChanged == 0) {
                continue;
            }
            changed += rideChanged;
            if (ride.status() == CarpoolRideStatus.CANCELLED) {
                rides.save(ride);
                passes.deleteByRideId(ride.id());
            } else {
                rides.save(ride);
            }
        }
        if (changed == 0) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "No waiting household leg assigned to you");
        }
        return saveResponseForOwnPlans(findOwnCircleLocalPlans(key, circleId), circleId);
    }

    /**
     * Confirms WAITING_HOUSEHOLD legs assigned to the caller on this circle's
     * active plan(s) for {@code eventKey}. Leaves other legs (Ask / other adults)
     * and pickup unchanged.
     */
    @Transactional
    public SaveCarpoolRidePlanResponse confirmHouseholdPlan(
            AdultResponse adult, UUID spaceId, String eventKey) {
        return mutateWaitingHousehold(adult, spaceId, eventKey, true);
    }

    /**
     * Declines WAITING_HOUSEHOLD legs assigned to the caller back to
     * NEEDS_RIDE. Leaves other legs and pickup unchanged.
     */
    @Transactional
    public SaveCarpoolRidePlanResponse declineHouseholdPlan(
            AdultResponse adult, UUID spaceId, String eventKey) {
        return mutateWaitingHousehold(adult, spaceId, eventKey, false);
    }

    /**
     * Clears named legs on this circle's active plan(s) for {@code eventKey}
     * (PENDING / ACCEPTED / PLAN), including circle-local null-space plans.
     * Does not rewrite remaining CONFIRMED household legs to WAITING.
     */
    @Transactional
    public SaveCarpoolRidePlanResponse clearPlanLegs(
            AdultResponse adult, UUID spaceId, String eventKey, List<CarpoolLegKind> requestedLegs) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        return clearOwnPlanLegs(adult, circleId, spaceId, eventKey, requestedLegs);
    }

    @Transactional
    public SaveCarpoolRidePlanResponse clearCirclePlanLegs(
            AdultResponse adult, String eventKey, List<CarpoolLegKind> requestedLegs) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return clearOwnPlanLegs(adult, circleId, null, eventKey, requestedLegs);
    }

    private SaveCarpoolRidePlanResponse clearOwnPlanLegs(
            AdultResponse adult,
            UUID circleId,
            UUID spaceId,
            String eventKey,
            List<CarpoolLegKind> requestedLegs) {
        if (eventKey == null || eventKey.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "eventKey is required");
        }
        String key = eventKey.trim();
        List<CarpoolRideRequestEntity> plans =
                spaceId != null
                        ? findOwnActivePlans(spaceId, key, circleId)
                        : findOwnCircleLocalPlans(key, circleId);
        if (plans.isEmpty() && spaceId != null) {
            plans = findOwnCircleLocalPlans(key, circleId);
            for (CarpoolRideRequestEntity ride : plans) {
                ride.attachSpaceId(spaceId);
            }
        }
        if (plans.isEmpty()) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "No active ride plan for this event");
        }
        boolean anyCleared = false;
        for (CarpoolRideRequestEntity ride : plans) {
            if (ride.status() != CarpoolRideStatus.PENDING
                    && ride.status() != CarpoolRideStatus.ACCEPTED
                    && ride.status() != CarpoolRideStatus.PLAN) {
                continue;
            }
            if (!planTouchesClear(ride, adult.id(), requestedLegs)) {
                continue;
            }
            Set<CarpoolLegKind> legsToClear = resolveClearLegs(ride, requestedLegs, true);
            UUID previousDriverId = ride.acceptedByAdultId();
            boolean wasAccepted = ride.status() == CarpoolRideStatus.ACCEPTED;
            ride.cancelLegs(legsToClear);
            anyCleared = true;
            if (ride.status() == CarpoolRideStatus.CANCELLED) {
                rides.save(ride);
                passes.deleteByRideId(ride.id());
                if (wasAccepted && previousDriverId != null && spaceId != null) {
                    refreshDriverRouteAfterAcceptedChange(previousDriverId, spaceId, ride.eventKey());
                }
                continue;
            }
            rides.save(ride);
            if (wasAccepted
                    && previousDriverId != null
                    && spaceId != null
                    && (ride.status() != CarpoolRideStatus.ACCEPTED
                            || !previousDriverId.equals(ride.acceptedByAdultId()))) {
                refreshDriverRouteAfterAcceptedChange(previousDriverId, spaceId, ride.eventKey());
            }
            if (ride.status() == CarpoolRideStatus.ACCEPTED
                    && ride.acceptedByAdultId() != null
                    && spaceId != null) {
                upsertAcceptedDriverRoute(ride, spaceId);
            }
        }
        if (!anyCleared) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "No active ride plan for this event");
        }
        List<CarpoolRideRequestEntity> remaining =
                spaceId != null
                        ? findOwnActivePlans(spaceId, key, circleId)
                        : findOwnCircleLocalPlans(key, circleId);
        return saveResponseForOwnPlans(remaining, circleId);
    }

    private boolean planTouchesClear(
            CarpoolRideRequestEntity ride, UUID adultId, List<CarpoolLegKind> requestedLegs) {
        Set<CarpoolLegKind> kinds =
                requestedLegs == null || requestedLegs.isEmpty()
                        ? EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM)
                        : EnumSet.copyOf(requestedLegs);
        for (RideLegSlot leg : ride.legs()) {
            if (!kinds.contains(leg.kind())) {
                continue;
            }
            if (adultId.equals(leg.assigneeAdultId())) {
                return true;
            }
            if (leg.phase() == CarpoolLegPhase.ASKED_TEAM
                    && adultId.equals(ride.requestedByAdultId())) {
                return true;
            }
        }
        return false;
    }

    private SaveCarpoolRidePlanResponse mutateWaitingHousehold(
            AdultResponse adult, UUID spaceId, String eventKey, boolean confirm) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        if (eventKey == null || eventKey.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "eventKey is required");
        }
        String key = eventKey.trim();
        List<CarpoolRideRequestEntity> plans = findOwnActivePlans(spaceId, key, circleId);
        if (plans.isEmpty()) {
            plans = findOwnCircleLocalPlans(key, circleId);
            for (CarpoolRideRequestEntity ride : plans) {
                ride.attachSpaceId(spaceId);
            }
        }
        if (plans.isEmpty()) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "No active ride plan for this event");
        }
        int changed = 0;
        for (CarpoolRideRequestEntity ride : plans) {
            int rideChanged =
                    confirm
                            ? ride.confirmWaitingHouseholdFor(adult.id())
                            : ride.declineWaitingHouseholdFor(adult.id());
            changed += rideChanged;
            if (rideChanged == 0) {
                continue;
            }
            if (ride.status() == CarpoolRideStatus.CANCELLED) {
                rides.save(ride);
                passes.deleteByRideId(ride.id());
            } else {
                rides.save(ride);
            }
        }
        if (changed == 0) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "No waiting household leg assigned to you");
        }
        return saveResponseForOwnPlans(findOwnActivePlans(spaceId, key, circleId), circleId);
    }

    private List<CarpoolRideRequestEntity> findOwnActivePlans(
            UUID spaceId, String eventKey, UUID circleId) {
        List<CarpoolRideRequestEntity> found = new ArrayList<>();
        for (CarpoolRideStatus status : OWN_PLAN_STATUSES) {
            found.addAll(
                    rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                            spaceId, eventKey, circleId, status));
        }
        return found;
    }

    private List<CarpoolRideRequestEntity> findOwnCircleLocalPlans(
            String eventKey, UUID circleId) {
        return rides.findByRequestingCircleIdAndEventKeyAndSpaceIdIsNullAndStatusIn(
                circleId, eventKey, OWN_PLAN_STATUSES);
    }

    private CarpoolRideRequestEntity findOwnActivePlan(
            UUID spaceId, String eventKey, UUID circleId) {
        List<CarpoolRideRequestEntity> found = findOwnActivePlans(spaceId, eventKey, circleId);
        return found.isEmpty() ? null : found.getFirst();
    }

    private CarpoolRideRequestEntity findOwnCircleLocalPlan(String eventKey, UUID circleId) {
        List<CarpoolRideRequestEntity> found = findOwnCircleLocalPlans(eventKey, circleId);
        return found.isEmpty() ? null : found.getFirst();
    }

    private record MergedPlanGroup(List<UUID> kidIds, List<RideLegSlot> legs) {}

    private List<MergedPlanGroup> resolveMergedPlanGroups(
            List<SaveCarpoolRidePlanGroup> plans,
            UUID callerAdultId,
            UUID circleId,
            List<UUID> goingKidsOrNull,
            boolean requireCoverGoingKids) {
        if (plans == null || plans.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "plans must not be empty");
        }
        Set<UUID> seenKids = new HashSet<>();
        Map<String, MergedPlanGroup> merged = new java.util.LinkedHashMap<>();
        for (SaveCarpoolRidePlanGroup group : plans) {
            if (group == null || group.kidIds() == null || group.kidIds().isEmpty()) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "each plan requires kidIds");
            }
            Map<CarpoolLegKind, SaveCarpoolRidePlanLeg> byKind = resolvePlanLegs(group.legs());
            List<RideLegSlot> slots = new ArrayList<>(2);
            slots.add(buildPlanSlot(byKind.get(CarpoolLegKind.TO), callerAdultId, circleId));
            slots.add(buildPlanSlot(byKind.get(CarpoolLegKind.FROM), callerAdultId, circleId));
            List<UUID> kidIds = new ArrayList<>();
            for (UUID kidId : group.kidIds()) {
                if (kidId == null) {
                    throw new CarpoolException(HttpStatus.BAD_REQUEST, "kidIds must not contain null");
                }
                if (!seenKids.add(kidId)) {
                    throw new CarpoolException(
                            HttpStatus.BAD_REQUEST, "A kid appears on more than one plan");
                }
                kidIds.add(kidId);
            }
            // Validate kids belong to circle via snapshots later per merged group
            String outcomeKey = planOutcomeKey(slots);
            MergedPlanGroup existing = merged.get(outcomeKey);
            if (existing == null) {
                merged.put(outcomeKey, new MergedPlanGroup(kidIds, slots));
            } else {
                List<UUID> combined = new ArrayList<>(existing.kidIds());
                combined.addAll(kidIds);
                merged.put(outcomeKey, new MergedPlanGroup(combined, existing.legs()));
            }
        }
        if (requireCoverGoingKids && goingKidsOrNull != null) {
            Set<UUID> going = new HashSet<>(goingKidsOrNull);
            if (!seenKids.equals(going)) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST,
                        "plans must cover every going kid exactly once");
            }
        }
        if (!requireCoverGoingKids && seenKids.isEmpty()) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "kidIds is required for household plans without a space");
        }
        return List.copyOf(merged.values());
    }

    private static String planOutcomeKey(List<RideLegSlot> slots) {
        StringBuilder key = new StringBuilder();
        for (RideLegSlot leg : slots) {
            key.append(leg.kind())
                    .append(':')
                    .append(leg.phase())
                    .append(':')
                    .append(leg.assigneeAdultId())
                    .append(':')
                    .append(leg.assigneeCircleId())
                    .append(':')
                    .append(leg.placeOutcomeKey())
                    .append('|');
        }
        return key.toString();
    }

    private void replaceOwnPlans(
            UUID adultId,
            UUID circleId,
            UUID spaceId,
            String eventKey,
            List<MergedPlanGroup> groups,
            String pickupName,
            String pickupAddress) {
        List<CarpoolRideRequestEntity> existing =
                spaceId != null
                        ? findOwnActivePlans(spaceId, eventKey, circleId)
                        : findOwnCircleLocalPlans(eventKey, circleId);
        Set<UUID> submittedKids = new HashSet<>();
        for (MergedPlanGroup group : groups) {
            submittedKids.addAll(group.kidIds());
        }
        for (CarpoolRideRequestEntity ride : existing) {
            boolean removedAny = false;
            for (UUID kidId : List.copyOf(
                    ride.kids().stream().map(RideKidSnapshot::kidId).toList())) {
                if (submittedKids.contains(kidId)) {
                    ride.removeKid(kidId);
                    removedAny = true;
                }
            }
            if (ride.kids().isEmpty()) {
                UUID previousDriverId = ride.acceptedByAdultId();
                boolean wasAccepted = ride.status() == CarpoolRideStatus.ACCEPTED;
                ride.cancel();
                rides.save(ride);
                passes.deleteByRideId(ride.id());
                if (wasAccepted && previousDriverId != null && spaceId != null) {
                    refreshDriverRouteAfterAcceptedChange(previousDriverId, spaceId, eventKey);
                }
            } else if (removedAny) {
                if (ride.status() == CarpoolRideStatus.ACCEPTED) {
                    // keep ACCEPTED bag without moved kids
                    rides.save(ride);
                } else {
                    // Remaining kids were not in the save — cancel leftover plan
                    ride.cancel();
                    rides.save(ride);
                    passes.deleteByRideId(ride.id());
                }
            } else if (ride.status() != CarpoolRideStatus.ACCEPTED) {
                // Save replaces all non-accepted plans for submitted coverage
                ride.cancel();
                rides.save(ride);
                passes.deleteByRideId(ride.id());
            }
        }
        // Re-check: ACCEPTED that still hold submitted kids with no remove means
        // those kids weren't removed because... we remove submitted kids from existing.
        // After loop, create new groups for non-blank outcomes.
        for (MergedPlanGroup group : groups) {
            if (group.legs().stream().allMatch(leg -> leg.phase() == CarpoolLegPhase.NEEDS_RIDE)) {
                continue;
            }
            List<RideKidSnapshot> snapshots = kidSnapshots(circleId, group.kidIds());
            Set<CarpoolLegKind> asked = EnumSet.noneOf(CarpoolLegKind.class);
            for (RideLegSlot leg : group.legs()) {
                if (leg.phase() == CarpoolLegPhase.ASKED_TEAM) {
                    asked.add(leg.kind());
                }
            }
            CarpoolRideRequestEntity created =
                    new CarpoolRideRequestEntity(
                            UUID.randomUUID(),
                            spaceId,
                            eventKey,
                            circleId,
                            adultId,
                            pickupName,
                            pickupAddress,
                            snapshots,
                            asked.isEmpty() ? EnumSet.noneOf(CarpoolLegKind.class) : asked,
                            Instant.now());
            created.replaceLegs(group.legs());
            rides.save(created);
        }
        assertKidExclusive(
                spaceId != null
                        ? findOwnActivePlans(spaceId, eventKey, circleId)
                        : findOwnCircleLocalPlans(eventKey, circleId));
    }

    private void assertKidExclusive(List<CarpoolRideRequestEntity> plans) {
        Set<UUID> seen = new HashSet<>();
        for (CarpoolRideRequestEntity ride : plans) {
            if (ride.status() == CarpoolRideStatus.CANCELLED) {
                continue;
            }
            for (RideKidSnapshot kid : ride.kids()) {
                if (!seen.add(kid.kidId())) {
                    throw new CarpoolException(
                            HttpStatus.CONFLICT,
                            "A kid appears on more than one active plan for this event");
                }
            }
        }
    }

    private SaveCarpoolRidePlanResponse saveResponseForOwnPlans(
            List<CarpoolRideRequestEntity> plans, UUID circleId) {
        Map<UUID, String> names = circleNames(List.of(circleId));
        Map<UUID, String> assigneeNames = new HashMap<>();
        for (CarpoolRideRequestEntity ride : plans) {
            assigneeNames.putAll(assigneeDisplayNames(ride));
        }
        List<CarpoolRideResponse> ownRequests = new ArrayList<>();
        for (CarpoolRideRequestEntity ride : plans) {
            if (ride.kids().isEmpty()) {
                continue;
            }
            ownRequests.add(
                    toRideResponse(ride, names, false, List.of(), null, assigneeNames));
        }
        return new SaveCarpoolRidePlanResponse(
                List.copyOf(ownRequests),
                singularOwnLegs(plans, names, assigneeNames),
                singularOwnRequest(ownRequests));
    }

    private List<CarpoolRideLegResponse> singularOwnLegs(
            List<CarpoolRideRequestEntity> plans,
            Map<UUID, String> circleNames,
            Map<UUID, String> adultDisplayNames) {
        if (plans.size() != 1) {
            return null;
        }
        return toLegResponses(plans.getFirst(), circleNames, adultDisplayNames);
    }

    private CarpoolRideResponse singularOwnRequest(List<CarpoolRideResponse> ownRequests) {
        if (ownRequests.size() != 1) {
            return null;
        }
        CarpoolRideResponse only = ownRequests.getFirst();
        if (only.status() == CarpoolRideStatus.PENDING
                || only.status() == CarpoolRideStatus.ACCEPTED) {
            return only;
        }
        return null;
    }

    private Map<CarpoolLegKind, SaveCarpoolRidePlanLeg> resolvePlanLegs(
            List<SaveCarpoolRidePlanLeg> legs) {
        if (legs == null || legs.size() != 2) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "legs must include exactly TO and FROM");
        }
        Map<CarpoolLegKind, SaveCarpoolRidePlanLeg> byKind = new HashMap<>();
        for (SaveCarpoolRidePlanLeg leg : legs) {
            if (leg == null || leg.kind() == null || leg.action() == null) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must not contain null");
            }
            if (byKind.put(leg.kind(), leg) != null) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must be unique by kind");
            }
        }
        if (!byKind.containsKey(CarpoolLegKind.TO) || !byKind.containsKey(CarpoolLegKind.FROM)) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "legs must include exactly TO and FROM");
        }
        return byKind;
    }

    private RideLegSlot buildPlanSlot(
            SaveCarpoolRidePlanLeg leg, UUID callerAdultId, UUID circleId) {
        RideLegSlot slot =
                switch (leg.action()) {
                    case NEEDS_RIDE -> {
                        if (leg.assigneeAdultId() != null) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST,
                                    "assigneeAdultId must be omitted for NEEDS_RIDE");
                        }
                        if (leg.placeId() != null || hasText(leg.placeAddress())) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST,
                                    "place fields must be omitted for NEEDS_RIDE");
                        }
                        if (leg.meetSide() != null) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST,
                                    "meetSide must be omitted for NEEDS_RIDE");
                        }
                        yield RideLegSlot.needsRide(leg.kind());
                    }
                    case ASK_TEAM -> {
                        if (leg.assigneeAdultId() != null) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST,
                                    "assigneeAdultId must be omitted for ASK_TEAM");
                        }
                        yield RideLegSlot.askedTeam(leg.kind());
                    }
                    case HOUSEHOLD -> {
                        if (leg.assigneeAdultId() == null) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST,
                                    "assigneeAdultId is required for HOUSEHOLD");
                        }
                        try {
                            familyMembershipApi.requireAdultInCircle(circleId, leg.assigneeAdultId());
                        } catch (com.yourorg.quickapp.family.FamilyAccessException ex) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST, "assigneeAdultId must be a circle adult");
                        }
                        if (leg.meetSide() != null) {
                            throw new CarpoolException(
                                    HttpStatus.BAD_REQUEST,
                                    "meetSide must be omitted for HOUSEHOLD");
                        }
                        if (leg.assigneeAdultId().equals(callerAdultId)) {
                            yield RideLegSlot.householdConfirmed(leg.kind(), leg.assigneeAdultId());
                        }
                        yield RideLegSlot.waitingHousehold(leg.kind(), leg.assigneeAdultId());
                    }
                };
        if (leg.action() == CarpoolRidePlanLegAction.ASK_TEAM) {
            CarpoolMeetSide meetSide =
                    leg.meetSide() == null ? CarpoolMeetSide.REQUESTER : leg.meetSide();
            slot.setMeetSide(meetSide);
            if (meetSide == CarpoolMeetSide.ACCEPTOR) {
                if (leg.placeId() != null || hasText(leg.placeAddress())) {
                    throw new CarpoolException(
                            HttpStatus.BAD_REQUEST,
                            "place fields must be omitted when meetSide is ACCEPTOR");
                }
                slot.clearFamilyPlace();
            } else {
                applyFamilyPlaceFromRequest(slot, callerAdultId, leg.placeId(), leg.placeAddress());
            }
        } else if (leg.action() != CarpoolRidePlanLegAction.NEEDS_RIDE) {
            slot.setMeetSide(CarpoolMeetSide.REQUESTER);
            applyFamilyPlaceFromRequest(slot, callerAdultId, leg.placeId(), leg.placeAddress());
        }
        return slot;
    }

    private List<RideKidSnapshot> kidSnapshots(UUID circleId, List<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        List<FamilyKidName> names = familyMembershipApi.findKids(circleId, kidIds);
        if (names.size() != kidIds.size()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "Kid not found in this circle");
        }
        Map<UUID, String> byId =
                names.stream().collect(Collectors.toMap(FamilyKidName::id, FamilyKidName::displayName));
        List<RideKidSnapshot> snapshots = new ArrayList<>();
        for (UUID kidId : kidIds) {
            snapshots.add(new RideKidSnapshot(kidId, byId.get(kidId)));
        }
        return snapshots;
    }

    @Transactional
    public CarpoolRideResponse accept(AdultResponse adult, UUID spaceId, UUID rideId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRideRequestEntity ride =
                rides.findByIdAndSpaceId(rideId, spaceId).orElseThrow(this::notFound);
        if (ride.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Cannot accept your own circle's request");
        }
        if (ride.status() != CarpoolRideStatus.PENDING) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Ride is not PENDING");
        }
        bindAcceptorPlacesOnAccept(ride, adult.id());
        ride.accept(adult.id(), circleId);
        syncRidePickupFromToLeg(ride);
        rides.save(ride);
        passes.deleteByRideId(ride.id());
        ensureRequestingKidsYes(ride, adult.id());
        upsertAcceptedDriverRoute(ride, spaceId);
        Map<UUID, String> names = circleNames(List.of(ride.requestingCircleId(), circleId));
        return toRideResponse(
                ride,
                names,
                false,
                List.of(),
                null,
                Map.of(adult.id(), adult.displayName()));
    }

    @Transactional
    public CarpoolRideResponse pass(AdultResponse adult, UUID spaceId, UUID rideId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRideRequestEntity ride =
                rides.findByIdAndSpaceId(rideId, spaceId).orElseThrow(this::notFound);
        if (ride.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Cannot pass on your own circle's request");
        }
        if (ride.status() != CarpoolRideStatus.PENDING) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Ride is not PENDING");
        }
        if (!passes.existsByRideIdAndAdultId(ride.id(), adult.id())) {
            passes.save(
                    new CarpoolRidePassEntity(
                            UUID.randomUUID(), ride.id(), adult.id(), Instant.now()));
        }
        List<CarpoolRidePassEntity> ridePasses =
                passesByRideId(List.of(ride.id())).getOrDefault(ride.id(), List.of());
        Map<UUID, String> adultDisplayNames = adultDisplayNames(List.of(ridePasses));
        return toRideResponse(
                ride,
                circleNames(List.of(ride.requestingCircleId(), circleId)),
                true,
                passedByAdultNames(ridePasses, adultDisplayNames),
                null,
                assigneeDisplayNames(ride));
    }

    @Transactional
    public CarpoolRideResponse cancel(
            AdultResponse adult, UUID spaceId, UUID rideId, List<CarpoolLegKind> requestedLegs) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRideRequestEntity ride =
                rides.findByIdAndSpaceId(rideId, spaceId).orElseThrow(this::notFound);
        if (!ride.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Caller's circle is not the requesting circle");
        }
        if (ride.status() != CarpoolRideStatus.PENDING
                && ride.status() != CarpoolRideStatus.ACCEPTED
                && ride.status() != CarpoolRideStatus.PLAN) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Ride is not PENDING, ACCEPTED, or PLAN");
        }
        Set<CarpoolLegKind> legsToClear = resolveClearLegs(ride, requestedLegs, true);
        UUID previousDriverId = ride.acceptedByAdultId();
        boolean wasAccepted = ride.status() == CarpoolRideStatus.ACCEPTED;
        ride.cancelLegs(legsToClear);
        rides.save(ride);
        if (ride.status() == CarpoolRideStatus.CANCELLED) {
            passes.deleteByRideId(ride.id());
        }
        if (wasAccepted
                && previousDriverId != null
                && (ride.status() != CarpoolRideStatus.ACCEPTED
                        || !previousDriverId.equals(ride.acceptedByAdultId()))) {
            refreshDriverRouteAfterAcceptedChange(previousDriverId, spaceId, ride.eventKey());
        }
        if (ride.status() == CarpoolRideStatus.ACCEPTED && ride.acceptedByAdultId() != null) {
            upsertAcceptedDriverRoute(ride, spaceId);
        }
        return toRideResponse(
                ride, circleNames(List.of(circleId)), false, List.of(), null, assigneeDisplayNames(ride));
    }

    @Transactional
    public CarpoolRideResponse withdraw(
            AdultResponse adult, UUID spaceId, UUID rideId, List<CarpoolLegKind> requestedLegs) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRideRequestEntity ride =
                rides.findByIdAndSpaceId(rideId, spaceId).orElseThrow(this::notFound);
        if (ride.acceptingCircleId() == null || !ride.acceptingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Caller's circle is not the accepting circle");
        }
        if (ride.status() != CarpoolRideStatus.ACCEPTED) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Ride is not ACCEPTED");
        }
        Set<CarpoolLegKind> legsToClear = resolveClearLegs(ride, requestedLegs, false);
        UUID previousDriverId = ride.acceptedByAdultId();
        ride.withdrawLegs(legsToClear);
        rides.save(ride);
        if (previousDriverId != null
                && (ride.status() != CarpoolRideStatus.ACCEPTED
                        || !previousDriverId.equals(ride.acceptedByAdultId()))) {
            refreshDriverRouteAfterAcceptedChange(previousDriverId, spaceId, ride.eventKey());
        }
        if (ride.status() == CarpoolRideStatus.ACCEPTED && ride.acceptedByAdultId() != null) {
            upsertAcceptedDriverRoute(ride, spaceId);
        }
        return toRideResponse(
                ride,
                circleNames(List.of(ride.requestingCircleId(), circleId)),
                false,
                List.of(),
                null,
                assigneeDisplayNames(ride));
    }

    @Transactional
    public CarpoolRideResponse cancel(AdultResponse adult, UUID spaceId, UUID rideId) {
        return cancel(adult, spaceId, rideId, null);
    }

    @Transactional
    public CarpoolRideResponse withdraw(AdultResponse adult, UUID spaceId, UUID rideId) {
        return withdraw(adult, spaceId, rideId, null);
    }

    /**
     * Same-transaction side effect of removing CONFIRMED coverage: return every
     * inbound ACCEPTED ride on this feed event to PENDING when this circle was
     * the acceptor.
     */
    @Transactional
    public void withdrawAcceptedInboundForFeedEvent(UUID actorAdultId, UUID feedEventId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(actorAdultId);
        Optional<FeedCalendarEventDto> event =
                feedCalendarApi.findEventInCircle(circleId, feedEventId);
        if (event.isEmpty()) {
            return;
        }
        String eventKey = RideEventKey.of(event.get());
        List<UUID> spaceIds =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(CarpoolMembershipEntity::spaceId)
                        .toList();
        if (spaceIds.isEmpty()) {
            return;
        }
        List<CarpoolRideRequestEntity> accepted =
                rides.findBySpaceIdInAndEventKeyAndAcceptingCircleIdAndStatus(
                        spaceIds, eventKey, circleId, CarpoolRideStatus.ACCEPTED);
        for (CarpoolRideRequestEntity ride : accepted) {
            UUID driverId = ride.acceptedByAdultId();
            ride.withdraw();
            rides.save(ride);
            if (driverId != null) {
                refreshDriverRouteAfterAcceptedChange(driverId, ride.spaceId(), eventKey);
            }
        }
    }

    /**
     * RSVP NO side effect: drop the kid from this circle's active ride plans
     * for the feed event. Empty plans are cancelled (both legs cleared).
     */
    @Transactional
    public void clearTransportForNotGoingKid(
            UUID actorAdultId, UUID feedEventId, UUID kidId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(actorAdultId);
        Optional<FeedCalendarEventDto> event =
                feedCalendarApi.findEventInCircle(circleId, feedEventId);
        if (event.isEmpty()) {
            return;
        }
        String eventKey = RideEventKey.of(event.get());
        List<UUID> spaceIds =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(CarpoolMembershipEntity::spaceId)
                        .toList();
        List<CarpoolRideRequestEntity> all = new ArrayList<>();
        if (!spaceIds.isEmpty()) {
            all.addAll(
                    rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                            spaceIds, eventKey, circleId, OWN_PLAN_STATUSES));
        }
        all.addAll(
                rides.findByRequestingCircleIdAndEventKeyAndSpaceIdIsNullAndStatusIn(
                        circleId, eventKey, OWN_PLAN_STATUSES));
        for (CarpoolRideRequestEntity ride : all) {
            if (!ride.removeKid(kidId)) {
                continue;
            }
            UUID previousDriverId = ride.acceptedByAdultId();
            boolean wasAccepted = ride.status() == CarpoolRideStatus.ACCEPTED;
            if (ride.kids().isEmpty()) {
                ride.cancel();
                rides.save(ride);
                passes.deleteByRideId(ride.id());
                if (wasAccepted && previousDriverId != null && ride.spaceId() != null) {
                    refreshDriverRouteAfterAcceptedChange(
                            previousDriverId, ride.spaceId(), eventKey);
                }
            } else {
                rides.save(ride);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<CarpoolAcceptedPickupDto> listAcceptedPickupsForFeedEvent(
            UUID circleId, UUID feedEventId) {
        Optional<FeedCalendarEventDto> event =
                feedCalendarApi.findEventInCircle(circleId, feedEventId);
        if (event.isEmpty()) {
            return List.of();
        }
        String eventKey = RideEventKey.of(event.get());
        List<UUID> spaceIds =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(CarpoolMembershipEntity::spaceId)
                        .toList();
        if (spaceIds.isEmpty()) {
            return List.of();
        }
        List<CarpoolRideRequestEntity> accepted =
                rides.findBySpaceIdInAndEventKeyAndStatus(
                        spaceIds, eventKey, CarpoolRideStatus.ACCEPTED);
        List<CarpoolAcceptedPickupDto> out = new ArrayList<>();
        for (CarpoolRideRequestEntity ride : accepted) {
            if (!circleId.equals(ride.requestingCircleId())
                    && !circleId.equals(ride.acceptingCircleId())) {
                continue;
            }
            if (ride.acceptedByAdultId() == null) {
                continue;
            }
            String pickupName = null;
            String pickupAddress = null;
            if (hasRequesterPickupStop(ride)) {
                pickupName = familySidePlaceName(ride, CarpoolLegKind.TO);
                pickupAddress = familySidePlaceAddress(ride, CarpoolLegKind.TO);
            }
            out.add(
                    new CarpoolAcceptedPickupDto(
                            ride.acceptedByAdultId(),
                            ride.acceptingCircleId(),
                            ride.requestingCircleId(),
                            pickupName,
                            pickupAddress,
                            ride.kids().stream().map(RideKidSnapshot::kidId).toList()));
        }
        return List.copyOf(out);
    }

    /**
     * CONFIRMED legs assigned to {@code adultId} for the given feed events
     * (own plans + inbound accepts). Pending asks excluded.
     */
    @Transactional(readOnly = true)
    public List<CarpoolConfirmedDrivingLegDto> listConfirmedDrivingLegs(
            UUID adultId, UUID circleId, Collection<UUID> feedEventIds) {
        if (feedEventIds == null || feedEventIds.isEmpty()) {
            return List.of();
        }
        Map<String, UUID> feedIdByEventKey = new HashMap<>();
        for (UUID feedEventId : feedEventIds) {
            Optional<FeedCalendarEventDto> event =
                    feedCalendarApi.findEventInCircle(circleId, feedEventId);
            if (event.isEmpty()) {
                continue;
            }
            feedIdByEventKey.put(RideEventKey.of(event.get()), feedEventId);
        }
        if (feedIdByEventKey.isEmpty()) {
            return List.of();
        }
        List<String> eventKeys = List.copyOf(feedIdByEventKey.keySet());
        List<UUID> spaceIds =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(CarpoolMembershipEntity::spaceId)
                        .toList();

        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<CarpoolConfirmedDrivingLegDto> out = new ArrayList<>();

        if (!spaceIds.isEmpty()) {
            for (CarpoolRideRequestEntity ride :
                    rides.findBySpaceIdInAndEventKeyInAndStatusIn(
                            spaceIds, eventKeys, OWN_PLAN_STATUSES)) {
                collectConfirmedLegs(adultId, ride, feedIdByEventKey, seen, out);
            }
        }
        for (CarpoolRideRequestEntity ride :
                rides.findByRequestingCircleIdAndEventKeyInAndSpaceIdIsNullAndStatusIn(
                        circleId, eventKeys, OWN_PLAN_STATUSES)) {
            collectConfirmedLegs(adultId, ride, feedIdByEventKey, seen, out);
        }
        return List.copyOf(out);
    }

    private static void collectConfirmedLegs(
            UUID adultId,
            CarpoolRideRequestEntity ride,
            Map<String, UUID> feedIdByEventKey,
            Set<String> seen,
            List<CarpoolConfirmedDrivingLegDto> out) {
        UUID feedEventId = feedIdByEventKey.get(ride.eventKey());
        if (feedEventId == null) {
            return;
        }
        for (RideLegSlot leg : ride.legs()) {
            if (leg.phase() != CarpoolLegPhase.CONFIRMED) {
                continue;
            }
            if (!adultId.equals(leg.assigneeAdultId())) {
                continue;
            }
            String dedupe = feedEventId + "|" + leg.kind().name();
            if (!seen.add(dedupe)) {
                continue;
            }
            out.add(new CarpoolConfirmedDrivingLegDto(feedEventId, leg.kind()));
        }
    }

    private void upsertAcceptedDriverRoute(CarpoolRideRequestEntity ride, UUID spaceId) {
        if (ride.acceptedByAdultId() == null) {
            return;
        }
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElse(null);
        if (space == null) {
            return;
        }
        Optional<FeedCalendarEventDto> event =
                findSpaceEvent(ride.acceptingCircleId(), space, ride.eventKey());
        if (event.isEmpty()) {
            return;
        }
        List<CalendarRoutePickupInput> pickups =
                pickupsForDriver(ride.acceptedByAdultId(), spaceId, ride.eventKey());
        if (pickups.isEmpty() && hasRequesterPickupStop(ride)) {
            pickups = List.of(toPickupInput(ride));
        }
        leaveByApi.upsertCalendarRoute(
                ride.acceptedByAdultId(),
                LeaveByItemSource.FEED,
                event.get().id(),
                event.get().title(),
                pickups,
                destinationName(event.get()),
                event.get().location());
    }

    private void refreshDriverRouteAfterAcceptedChange(
            UUID drivingAdultId, UUID spaceId, String eventKey) {
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElse(null);
        if (space == null) {
            return;
        }
        UUID driverCircleId;
        try {
            driverCircleId = familyMembershipApi.requireMemberCircleId(drivingAdultId);
        } catch (RuntimeException ex) {
            return;
        }
        Optional<FeedCalendarEventDto> event = findSpaceEvent(driverCircleId, space, eventKey);
        if (event.isEmpty()) {
            return;
        }
        List<CalendarRoutePickupInput> pickups =
                pickupsForDriver(drivingAdultId, spaceId, eventKey);
        if (pickups.isEmpty()) {
            leaveByApi.invalidateCalendarRoute(
                    drivingAdultId, LeaveByItemSource.FEED, event.get().id());
            return;
        }
        leaveByApi.upsertCalendarRoute(
                drivingAdultId,
                LeaveByItemSource.FEED,
                event.get().id(),
                event.get().title(),
                pickups,
                destinationName(event.get()),
                event.get().location());
    }

    private List<CalendarRoutePickupInput> pickupsForDriver(
            UUID drivingAdultId, UUID spaceId, String eventKey) {
        List<CarpoolRideRequestEntity> accepted =
                rides.findBySpaceIdInAndEventKeyAndAcceptedByAdultIdAndStatus(
                        List.of(spaceId), eventKey, drivingAdultId, CarpoolRideStatus.ACCEPTED);
        if (accepted.isEmpty()) {
            return List.of();
        }
        List<CarpoolRideRequestEntity> withRequesterPickup =
                accepted.stream().filter(CarpoolRideService::hasRequesterPickupStop).toList();
        if (withRequesterPickup.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> names =
                circleNames(
                        withRequesterPickup.stream()
                                .map(CarpoolRideRequestEntity::requestingCircleId)
                                .distinct()
                                .toList());
        List<CalendarRoutePickupInput> pickups = new ArrayList<>();
        for (CarpoolRideRequestEntity ride : withRequesterPickup) {
            String placeName = familySidePlaceName(ride, CarpoolLegKind.TO);
            String placeAddress = familySidePlaceAddress(ride, CarpoolLegKind.TO);
            String to = names.get(ride.requestingCircleId());
            if (to == null || to.isBlank()) {
                to = placeName;
            }
            if (to == null || to.isBlank()) {
                to = "Family";
            }
            pickups.add(
                    new CalendarRoutePickupInput(
                            placeName,
                            placeAddress,
                            new CalendarRouteNotifyContact(CalendarRouteNotifyChannel.PUSH, to)));
        }
        return pickups;
    }

    private CalendarRoutePickupInput toPickupInput(CarpoolRideRequestEntity ride) {
        String placeName = familySidePlaceName(ride, CarpoolLegKind.TO);
        String placeAddress = familySidePlaceAddress(ride, CarpoolLegKind.TO);
        String to =
                familyMembershipApi
                        .findCircle(ride.requestingCircleId())
                        .map(FamilyCircleName::name)
                        .filter(name -> name != null && !name.isBlank())
                        .orElse(placeName);
        if (to == null || to.isBlank()) {
            to = "Family";
        }
        return new CalendarRoutePickupInput(
                placeName,
                placeAddress,
                new CalendarRouteNotifyContact(CalendarRouteNotifyChannel.PUSH, to));
    }

    private static String destinationName(FeedCalendarEventDto event) {
        if (event.location() != null && !event.location().isBlank()) {
            return event.location();
        }
        return event.title();
    }

    private List<UUID> defaultKidIds(UUID circleId, UUID spaceId, FeedCalendarEventDto event) {
        List<UUID> feedKids = event.kidIds() == null ? List.of() : event.kidIds();
        if (feedKids.isEmpty()) {
            return List.of();
        }
        Map<UUID, RsvpStatus> byKid =
                rsvpApi.statusesForKids(circleId, RsvpItemSource.FEED, event.id(), feedKids).stream()
                        .collect(
                                Collectors.toMap(
                                        RsvpDto::kidId, RsvpDto::status, (left, right) -> left));
        Set<UUID> covered = acceptedKidIds(spaceId, RideEventKey.of(event), circleId);
        return feedKids.stream()
                .filter(kidId -> byKid.getOrDefault(kidId, RsvpStatus.NO_RESPONSE) != RsvpStatus.NO)
                .filter(kidId -> !covered.contains(kidId))
                .distinct()
                .toList();
    }

    private List<UUID> resolveCreateKids(List<UUID> requested, List<UUID> defaultKids) {
        if (defaultKids.isEmpty() && (requested == null || requested.isEmpty())) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "No kids need a ride for this event");
        }
        if (requested == null || requested.isEmpty()) {
            return defaultKids;
        }
        List<UUID> unique = new ArrayList<>(new LinkedHashSet<>(requested));
        if (unique.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "kidIds must not be empty");
        }
        Set<UUID> allowed = new HashSet<>(defaultKids);
        for (UUID kidId : unique) {
            if (!allowed.contains(kidId)) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST,
                        "Kid is not eligible for a ride (RSVP No, unknown, or already covered)");
            }
        }
        return unique;
    }

    private void ensureRequestingKidsYes(CarpoolRideRequestEntity ride, UUID updatedByAdultId) {
        CarpoolSpaceEntity space = spaces.findById(ride.spaceId()).orElseThrow(this::notFound);
        FeedCalendarEventDto event =
                findSpaceEvent(ride.requestingCircleId(), space, ride.eventKey())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST,
                                                "Unknown event for requesting circle"));
        for (RideKidSnapshot kid : ride.kids()) {
            rsvpApi.setStatus(
                    ride.requestingCircleId(),
                    RsvpItemSource.FEED,
                    event.id(),
                    kid.kidId(),
                    RsvpStatus.YES,
                    updatedByAdultId);
        }
    }

    private Set<UUID> acceptedKidIds(UUID spaceId, String eventKey, UUID circleId) {
        List<CarpoolRideRequestEntity> accepted =
                rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, eventKey, circleId, CarpoolRideStatus.ACCEPTED);
        Set<UUID> kidIds = new HashSet<>();
        for (CarpoolRideRequestEntity ride : accepted) {
            for (RideKidSnapshot kid : ride.kids()) {
                kidIds.add(kid.kidId());
            }
        }
        return kidIds;
    }

    private Optional<FeedCalendarEventDto> findSpaceEvent(
            UUID circleId, CarpoolSpaceEntity space, String eventKey) {
        if (eventKey == null || eventKey.isBlank()) {
            return Optional.empty();
        }
        return spaceEvents(circleId, space, EVENT_LOOKUP_FROM, EVENT_LOOKUP_TO).stream()
                .filter(event -> eventKey.equals(RideEventKey.of(event)))
                .findFirst();
    }

    private List<FeedCalendarEventDto> spaceEvents(
            UUID circleId, CarpoolSpaceEntity space, Instant from, Instant to) {
        Optional<FeedResponse> feed =
                feedsApi.findByCircleAndNormalizedUrl(circleId, space.normalizedSourceUrl());
        if (feed.isEmpty()) {
            return List.of();
        }
        UUID feedId = feed.get().id();
        return feedCalendarApi.listEventsInRange(circleId, from, to).stream()
                .filter(event -> feedId.equals(event.feedId()))
                .toList();
    }

    private static void requireValidRange(Instant from, Instant to) {
        if (from == null || to == null) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (!from.isBefore(to)) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "from must be before to");
        }
        if (Duration.between(from, to).compareTo(MAX_WINDOW) > 0) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "Window must not exceed 31 days");
        }
    }

    private CarpoolRideResponse toRideResponse(
            CarpoolRideRequestEntity ride,
            Map<UUID, String> circleNames,
            boolean passedByMe,
            List<String> passedByAdultNames,
            Integer detourMinutes,
            Map<UUID, String> assigneeAdultNames) {
        List<UUID> kidIds = ride.kids().stream().map(RideKidSnapshot::kidId).toList();
        List<String> firstNames = ride.kids().stream().map(RideKidSnapshot::firstName).toList();
        return new CarpoolRideResponse(
                ride.id(),
                ride.spaceId(),
                ride.eventKey(),
                ride.requestingCircleId(),
                circleNames.get(ride.requestingCircleId()),
                ride.requestedByAdultId(),
                kidIds,
                firstNames,
                ride.seats(),
                ride.pickupPlaceName(),
                ride.pickupAddress(),
                ride.status(),
                toLegResponses(ride, circleNames, assigneeAdultNames),
                passedByMe,
                List.copyOf(passedByAdultNames),
                ride.acceptedByAdultId(),
                ride.acceptingCircleId(),
                ride.acceptingCircleId() == null ? null : circleNames.get(ride.acceptingCircleId()),
                PickupTownParser.pickupTownFromAddress(ride.pickupAddress()),
                detourMinutes);
    }

    private List<CarpoolRideLegResponse> toLegResponses(
            CarpoolRideRequestEntity ride,
            Map<UUID, String> circleNames,
            Map<UUID, String> assigneeAdultNames) {
        List<CarpoolRideLegResponse> out = new ArrayList<>(2);
        for (RideLegSlot leg : ride.legs()) {
            FamilyPlaceView place = familyPlaceView(ride, leg);
            out.add(
                    new CarpoolRideLegResponse(
                            leg.kind(),
                            leg.phase(),
                            leg.assigneeAdultId(),
                            leg.assigneeAdultId() == null
                                    ? null
                                    : assigneeAdultNames.get(leg.assigneeAdultId()),
                            leg.assigneeCircleId(),
                            leg.assigneeCircleId() == null
                                    ? null
                                    : circleNames.get(leg.assigneeCircleId()),
                            place.placeId(),
                            place.placeName(),
                            place.placeAddress(),
                            leg.meetSide()));
        }
        return List.copyOf(out);
    }

    private static List<CarpoolRideLegResponse> needsRideOwnLegs() {
        return List.of(
                new CarpoolRideLegResponse(
                        CarpoolLegKind.TO,
                        CarpoolLegPhase.NEEDS_RIDE,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        CarpoolMeetSide.REQUESTER),
                new CarpoolRideLegResponse(
                        CarpoolLegKind.FROM,
                        CarpoolLegPhase.NEEDS_RIDE,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        CarpoolMeetSide.REQUESTER));
    }

    private Map<UUID, String> assigneeDisplayNames(CarpoolRideRequestEntity ride) {
        Map<UUID, String> names = new HashMap<>();
        for (RideLegSlot leg : ride.legs()) {
            if (leg.assigneeAdultId() != null && !names.containsKey(leg.assigneeAdultId())) {
                names.put(
                        leg.assigneeAdultId(),
                        adultSessionApi.requireAdult(leg.assigneeAdultId()).displayName());
            }
        }
        return names;
    }

    private Set<CarpoolLegKind> resolveCreateLegs(List<CarpoolLegKind> requested) {
        if (requested == null || requested.isEmpty()) {
            return EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM);
        }
        Set<CarpoolLegKind> unique = EnumSet.noneOf(CarpoolLegKind.class);
        for (CarpoolLegKind kind : requested) {
            if (kind == null) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must not contain null");
            }
            unique.add(kind);
        }
        if (unique.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must not be empty");
        }
        return unique;
    }

    /**
     * @param cancelMode true for cancel (ASKED_TEAM or CONFIRMED); false for withdraw
     *     (CONFIRMED team legs only)
     */
    private Set<CarpoolLegKind> resolveClearLegs(
            CarpoolRideRequestEntity ride, List<CarpoolLegKind> requestedLegs, boolean cancelMode) {
        if (requestedLegs == null || requestedLegs.isEmpty()) {
            if (!cancelMode) {
                Set<CarpoolLegKind> owned =
                        ride.confirmedTeamLegKinds(ride.acceptingCircleId());
                if (!owned.isEmpty()) {
                    return owned;
                }
            }
            if (!ride.assigneesMatchForCombinedClear()) {
                throw new CarpoolException(
                        HttpStatus.CONFLICT,
                        "legs required when assignees differ across legs");
            }
            return EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM);
        }
        Set<CarpoolLegKind> unique = EnumSet.noneOf(CarpoolLegKind.class);
        for (CarpoolLegKind kind : requestedLegs) {
            if (kind == null) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must not contain null");
            }
            unique.add(kind);
        }
        if (unique.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must not be empty");
        }
        if (!cancelMode) {
            for (CarpoolLegKind kind : unique) {
                RideLegSlot leg = ride.leg(kind);
                if (leg.phase() != CarpoolLegPhase.CONFIRMED
                        || leg.assigneeCircleId() == null) {
                    throw new CarpoolException(
                            HttpStatus.CONFLICT, "Can only withdraw confirmed team legs");
                }
            }
        }
        return unique;
    }

    private Map<UUID, Integer> detourMinutesByRideId(
            UUID adultId, List<UUID> rideIds, List<DetourItemInput> items) {
        if (rideIds.isEmpty()) {
            return Map.of();
        }
        List<Integer> minutes = leaveByApi.detourMinutesMany(adultId, items);
        Map<UUID, Integer> byRideId = new HashMap<>();
        for (int i = 0; i < rideIds.size(); i++) {
            byRideId.put(rideIds.get(i), minutes.get(i));
        }
        return byRideId;
    }

    private Map<UUID, List<CarpoolRidePassEntity>> passesByRideId(Collection<UUID> rideIds) {
        if (rideIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<CarpoolRidePassEntity>> byRide = new HashMap<>();
        for (CarpoolRidePassEntity pass : passes.findByRideIdIn(rideIds)) {
            byRide.computeIfAbsent(pass.rideId(), ignored -> new ArrayList<>()).add(pass);
        }
        for (List<CarpoolRidePassEntity> group : byRide.values()) {
            group.sort(Comparator.comparing(CarpoolRidePassEntity::createdAt));
        }
        return byRide;
    }

    private Map<UUID, String> adultDisplayNames(
            Collection<List<CarpoolRidePassEntity>> passGroups) {
        Set<UUID> adultIds = new HashSet<>();
        for (List<CarpoolRidePassEntity> group : passGroups) {
            for (CarpoolRidePassEntity pass : group) {
                adultIds.add(pass.adultId());
            }
        }
        Map<UUID, String> names = new HashMap<>();
        for (UUID passerId : adultIds) {
            names.put(passerId, adultSessionApi.requireAdult(passerId).displayName());
        }
        return names;
    }

    private static List<String> passedByAdultNames(
            List<CarpoolRidePassEntity> ridePasses, Map<UUID, String> adultDisplayNames) {
        if (ridePasses.isEmpty()) {
            return List.of();
        }
        List<String> names = new ArrayList<>(ridePasses.size());
        for (CarpoolRidePassEntity pass : ridePasses) {
            names.add(adultDisplayNames.get(pass.adultId()));
        }
        return names;
    }

    private Map<UUID, String> circleNames(Collection<UUID> circleIds) {
        Map<UUID, String> names = new HashMap<>();
        for (FamilyCircleName row : familyMembershipApi.findCircles(circleIds)) {
            names.put(row.id(), row.name());
        }
        return names;
    }

    private ResolvedFamilyPlace resolveToPickupFromGroups(
            List<MergedPlanGroup> groups, boolean requireAddress) {
        RideLegSlot toLeg = null;
        for (MergedPlanGroup group : groups) {
            for (RideLegSlot leg : group.legs()) {
                if (leg.kind() == CarpoolLegKind.TO
                        && leg.phase() != CarpoolLegPhase.NEEDS_RIDE) {
                    toLeg = leg;
                    break;
                }
            }
            if (toLeg != null) {
                break;
            }
        }
        if (toLeg == null) {
            if (requireAddress) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST,
                        "No pickup address; add a home address in Places");
            }
            return null;
        }
        if (toLeg.meetSide() == CarpoolMeetSide.ACCEPTOR) {
            return new ResolvedFamilyPlace(null, null, DRIVER_PLACE_DISPLAY, "");
        }
        String address = toLeg.placeAddress();
        if (!hasText(address)) {
            if (requireAddress) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST,
                        "No pickup address; add a home address in Places");
            }
            return null;
        }
        return new ResolvedFamilyPlace(
                toLeg.placeId(),
                toLeg.oneTimeAddress(),
                toLeg.placeName() == null || toLeg.placeName().isBlank()
                        ? address
                        : toLeg.placeName(),
                address);
    }

    private ResolvedFamilyPlace requireResolvedToPickup(
            UUID adultId, UUID placeId, String placeAddress) {
        ResolvedFamilyPlace resolved = resolveFamilyPlace(adultId, placeId, placeAddress);
        if (resolved == null || !hasText(resolved.displayAddress())) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "No pickup address; add a home address in Places");
        }
        return resolved;
    }

    private void applyFamilyPlaceFromRequest(
            RideLegSlot slot, UUID adultId, UUID placeId, String placeAddress) {
        ResolvedFamilyPlace resolved = resolveFamilyPlace(adultId, placeId, placeAddress);
        if (resolved == null) {
            // Default with nothing to resolve — leave nulls (household-only OK).
            slot.clearFamilyPlace();
            return;
        }
        slot.setFamilyPlace(
                resolved.storedPlaceId(),
                resolved.storedOneTimeAddress(),
                resolved.displayName(),
                resolved.displayAddress());
    }

    private static void applyDefaultFamilyPlace(RideLegSlot slot, ResolvedFamilyPlace pickup) {
        slot.setFamilyPlace(null, null, pickup.displayName(), pickup.displayAddress());
    }

    /**
     * Resolves family-side place triad: named place, one-time address, or Default
     * (membership default leave-from → first located by name).
     */
    private ResolvedFamilyPlace resolveFamilyPlace(
            UUID adultId, UUID placeId, String placeAddress) {
        String trimmed = placeAddress == null ? null : placeAddress.trim();
        if (trimmed != null && trimmed.isEmpty()) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "placeAddress must be non-empty when set");
        }
        if (placeId != null && trimmed != null) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "placeId and placeAddress are mutually exclusive");
        }
        if (trimmed != null && trimmed.length() > FAMILY_PLACE_ADDRESS_MAX) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "placeAddress must be at most " + FAMILY_PLACE_ADDRESS_MAX + " characters");
        }
        if (placeId != null) {
            CirclePlaceDto place;
            try {
                place = familyPlaceApi.requireLocatedPlaceForMember(adultId, placeId);
            } catch (com.yourorg.quickapp.family.FamilyAccessException ex) {
                throw new CarpoolException(ex.status(), ex.getMessage());
            }
            if (!hasText(place.address())) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Place has no address; pick another");
            }
            return new ResolvedFamilyPlace(place.id(), null, place.name(), place.address());
        }
        if (trimmed != null) {
            return new ResolvedFamilyPlace(null, trimmed, trimmed, trimmed);
        }
        Optional<CirclePlaceDto> defaultPlace = resolveDefaultFamilyPlace(adultId);
        if (defaultPlace.isEmpty() || !hasText(defaultPlace.get().address())) {
            return null;
        }
        CirclePlaceDto place = defaultPlace.get();
        // Default mode stores null place id + null one-time; snapshots only.
        return new ResolvedFamilyPlace(null, null, place.name(), place.address());
    }

    /**
     * Default origin: My default leave-from when usable, else first located place
     * by name.
     */
    private Optional<CirclePlaceDto> resolveDefaultFamilyPlace(UUID adultId) {
        Optional<CirclePlaceDto> membershipDefault =
                familyPlaceApi.findDefaultLeaveFromForMember(adultId);
        if (membershipDefault.isPresent() && hasText(membershipDefault.get().address())) {
            return membershipDefault;
        }
        // Prefer addressed located places; list is already name-sorted.
        return familyPlaceApi.listLocatedPlacesForMember(adultId).stream()
                .filter(place -> hasText(place.address()))
                .findFirst();
    }

    private String familySidePlaceName(CarpoolRideRequestEntity ride, CarpoolLegKind kind) {
        FamilyPlaceView view = familyPlaceView(ride, ride.leg(kind));
        if (hasText(view.placeName())) {
            return view.placeName();
        }
        return ride.pickupPlaceName();
    }

    private String familySidePlaceAddress(CarpoolRideRequestEntity ride, CarpoolLegKind kind) {
        FamilyPlaceView view = familyPlaceView(ride, ride.leg(kind));
        if (hasText(view.placeAddress())) {
            return view.placeAddress();
        }
        return ride.pickupAddress();
    }

    /**
     * Display view for a leg. Default rows without snapshots re-resolve via the
     * requester's membership default / first located place. ACCEPTOR legs pending
     * Accept show Driver's place without a street address.
     */
    private FamilyPlaceView familyPlaceView(CarpoolRideRequestEntity ride, RideLegSlot leg) {
        if (leg == null) {
            return new FamilyPlaceView(null, null, null);
        }
        if (leg.meetSide() == CarpoolMeetSide.ACCEPTOR
                && leg.phase() == CarpoolLegPhase.ASKED_TEAM
                && leg.placeId() == null
                && !hasText(leg.oneTimeAddress())
                && !hasText(leg.placeAddress())
                && !hasText(leg.placeName())) {
            return new FamilyPlaceView(null, DRIVER_PLACE_DISPLAY, null);
        }
        if (leg.placeId() != null || hasText(leg.oneTimeAddress())) {
            String name = leg.placeName();
            String address =
                    hasText(leg.placeAddress())
                            ? leg.placeAddress()
                            : leg.oneTimeAddress();
            if (!hasText(name) && hasText(address)) {
                name = address;
            }
            return new FamilyPlaceView(leg.placeId(), name, address);
        }
        // Default mode (or legacy null columns).
        if (hasText(leg.placeAddress()) || hasText(leg.placeName())) {
            return new FamilyPlaceView(null, leg.placeName(), leg.placeAddress());
        }
        if (leg.phase() == CarpoolLegPhase.NEEDS_RIDE
                || leg.meetSide() == CarpoolMeetSide.ACCEPTOR) {
            return new FamilyPlaceView(null, null, null);
        }
        Optional<CirclePlaceDto> resolved =
                resolveDefaultFamilyPlace(ride.requestedByAdultId());
        if (resolved.isEmpty()) {
            return new FamilyPlaceView(null, null, null);
        }
        CirclePlaceDto place = resolved.get();
        return new FamilyPlaceView(null, place.name(), place.address());
    }

    /**
     * On Accept, bind accepter leave-from onto each still-open ASKED_TEAM leg with
     * meet side ACCEPTOR. Fails with 400 when that place cannot resolve.
     */
    private void bindAcceptorPlacesOnAccept(CarpoolRideRequestEntity ride, UUID accepterAdultId) {
        boolean needsBind = false;
        for (RideLegSlot leg : ride.legs()) {
            if (leg.phase() == CarpoolLegPhase.ASKED_TEAM
                    && leg.meetSide() == CarpoolMeetSide.ACCEPTOR) {
                needsBind = true;
                break;
            }
        }
        if (!needsBind) {
            return;
        }
        ResolvedFamilyPlace accepterPlace = resolveFamilyPlace(accepterAdultId, null, null);
        if (accepterPlace == null || !hasText(accepterPlace.displayAddress())) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "No leave-from place; add a home address in Places");
        }
        for (RideLegSlot leg : ride.legs()) {
            if (leg.phase() == CarpoolLegPhase.ASKED_TEAM
                    && leg.meetSide() == CarpoolMeetSide.ACCEPTOR) {
                applyDefaultFamilyPlace(leg, accepterPlace);
            }
        }
    }

    /** Refresh ride-level pickup fields from the TO family-side place. */
    private void syncRidePickupFromToLeg(CarpoolRideRequestEntity ride) {
        RideLegSlot toLeg = ride.leg(CarpoolLegKind.TO);
        if (toLeg.meetSide() == CarpoolMeetSide.ACCEPTOR
                && toLeg.phase() == CarpoolLegPhase.ASKED_TEAM
                && !hasText(toLeg.placeAddress())) {
            ride.updatePickup(DRIVER_PLACE_DISPLAY, "");
            return;
        }
        FamilyPlaceView view = familyPlaceView(ride, toLeg);
        if (hasText(view.placeAddress())) {
            String name =
                    hasText(view.placeName()) ? view.placeName() : view.placeAddress();
            ride.updatePickup(name, view.placeAddress());
        } else if (toLeg.meetSide() == CarpoolMeetSide.ACCEPTOR) {
            ride.updatePickup(DRIVER_PLACE_DISPLAY, "");
        }
    }

    /** TO meet at requester place — inbound detour / Route pickup stop. */
    private static boolean hasRequesterPickupStop(CarpoolRideRequestEntity ride) {
        RideLegSlot toLeg = ride.leg(CarpoolLegKind.TO);
        return toLeg.meetSide() == CarpoolMeetSide.REQUESTER
                && toLeg.phase() != CarpoolLegPhase.NEEDS_RIDE;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * @param storedPlaceId null for Default and one-time
     * @param storedOneTimeAddress null for Default and named place
     */
    private record ResolvedFamilyPlace(
            UUID storedPlaceId,
            String storedOneTimeAddress,
            String displayName,
            String displayAddress) {}

    private record FamilyPlaceView(UUID placeId, String placeName, String placeAddress) {}

    private CarpoolSpaceEntity requireMemberSpace(UUID spaceId, UUID circleId) {
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElseThrow(this::notFound);
        if (memberships.findBySpaceIdAndCircleId(spaceId, circleId).isEmpty()) {
            throw notFound();
        }
        return space;
    }

    private CarpoolException notFound() {
        return new CarpoolException(HttpStatus.NOT_FOUND, "Space not found");
    }
}
