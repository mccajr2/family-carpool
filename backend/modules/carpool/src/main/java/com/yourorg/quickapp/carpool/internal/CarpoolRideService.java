package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.AcceptCarpoolRequestRequest;
import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolFulfillmentStatus;
import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
import com.yourorg.quickapp.carpool.CarpoolRequestResponse;
import com.yourorg.quickapp.carpool.CarpoolRideEventResponse;
import com.yourorg.quickapp.carpool.CarpoolRideResponse;
import com.yourorg.quickapp.carpool.CreateCarpoolRequestRequest;
import com.yourorg.quickapp.carpool.CreateCarpoolRideRequest;
import com.yourorg.quickapp.carpool.PatchCarpoolRequestRequest;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyGarageApi;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.family.GarageMemberDrivesResponse;
import com.yourorg.quickapp.family.GarageResponse;
import com.yourorg.quickapp.family.VehicleResponse;
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
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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

    private final AdultSessionApi adultSessionApi;
    private final FamilyMembershipApi familyMembershipApi;
    private final FamilyPlaceApi familyPlaceApi;
    private final FamilyGarageApi familyGarageApi;
    private final FeedsApi feedsApi;
    private final FeedCalendarApi feedCalendarApi;
    private final RsvpApi rsvpApi;
    private final LeaveByApi leaveByApi;
    private final CarpoolSpaceRepository spaces;
    private final CarpoolMembershipRepository memberships;
    private final CarpoolRequestRepository requests;
    private final CarpoolRideRepository rides;
    private final CarpoolRequestPassRepository passes;
    private final CarpoolRequestRideModelService modelService;

    public CarpoolRideService(
            AdultSessionApi adultSessionApi,
            FamilyMembershipApi familyMembershipApi,
            FamilyPlaceApi familyPlaceApi,
            FamilyGarageApi familyGarageApi,
            FeedsApi feedsApi,
            FeedCalendarApi feedCalendarApi,
            RsvpApi rsvpApi,
            LeaveByApi leaveByApi,
            CarpoolSpaceRepository spaces,
            CarpoolMembershipRepository memberships,
            CarpoolRequestRepository requests,
            CarpoolRideRepository rides,
            CarpoolRequestPassRepository passes,
            CarpoolRequestRideModelService modelService) {
        this.adultSessionApi = adultSessionApi;
        this.familyMembershipApi = familyMembershipApi;
        this.familyPlaceApi = familyPlaceApi;
        this.familyGarageApi = familyGarageApi;
        this.feedsApi = feedsApi;
        this.feedCalendarApi = feedCalendarApi;
        this.rsvpApi = rsvpApi;
        this.leaveByApi = leaveByApi;
        this.spaces = spaces;
        this.memberships = memberships;
        this.requests = requests;
        this.rides = rides;
        this.passes = passes;
        this.modelService = modelService;
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
        List<String> eventKeys =
                events.stream().map(RideEventKey::of).distinct().toList();
        Map<String, List<CarpoolRequestEntity>> requestsByKey =
                requests.findBySpaceIdAndEventKeyIn(spaceId, eventKeys).stream()
                        .collect(Collectors.groupingBy(CarpoolRequestEntity::eventKey));
        Map<String, List<CarpoolRideEntity>> ridesByKey =
                rides
                        .findBySpaceIdAndEventKeyInAndStatus(
                                spaceId, eventKeys, CarpoolFulfillmentStatus.ACTIVE)
                        .stream()
                        .collect(Collectors.groupingBy(CarpoolRideEntity::eventKey));

        Set<UUID> circleIds = new HashSet<>();
        Set<UUID> vehicleCircleIds = new HashSet<>();
        for (List<CarpoolRequestEntity> group : requestsByKey.values()) {
            for (CarpoolRequestEntity request : group) {
                circleIds.add(request.requestingCircleId());
            }
        }
        for (List<CarpoolRideEntity> group : ridesByKey.values()) {
            for (CarpoolRideEntity ride : group) {
                circleIds.add(ride.drivingCircleId());
                vehicleCircleIds.add(ride.drivingCircleId());
            }
        }
        Map<UUID, String> circleNames = circleNames(circleIds);
        Map<UUID, String> vehicleLabels = vehicleLabels(vehicleCircleIds);

        Set<UUID> listedRequestIds =
                requestsByKey.values().stream()
                        .flatMap(List::stream)
                        .map(CarpoolRequestEntity::id)
                        .collect(Collectors.toSet());
        Map<UUID, List<CarpoolRequestPassEntity>> passesByRequest =
                passesByRequestId(listedRequestIds);
        Map<UUID, String> adultDisplayNames = adultDisplayNames(passesByRequest.values());

        Map<String, FeedCalendarEventDto> eventsByKey = new HashMap<>();
        for (FeedCalendarEventDto event : events) {
            eventsByKey.put(RideEventKey.of(event), event);
        }

        List<DetourItemInput> detourItems = new ArrayList<>();
        List<UUID> detourRequestIds = new ArrayList<>();
        for (List<CarpoolRequestEntity> group : requestsByKey.values()) {
            for (CarpoolRequestEntity request : group) {
                if (request.requestingCircleId().equals(circleId)) {
                    continue;
                }
                FeedCalendarEventDto event = eventsByKey.get(request.eventKey());
                String eventLocation = event == null ? null : event.location();
                detourItems.add(new DetourItemInput(request.pickupAddress(), eventLocation));
                detourRequestIds.add(request.id());
            }
        }
        Map<UUID, Integer> detourMinutesByRequestId =
                detourMinutesByRequestId(adult.id(), detourRequestIds, detourItems);

        List<CarpoolRideEventResponse> result = new ArrayList<>();
        for (FeedCalendarEventDto event : events) {
            String eventKey = RideEventKey.of(event);
            List<CarpoolRequestEntity> eventRequests =
                    requestsByKey.getOrDefault(eventKey, List.of());
            List<CarpoolRideEntity> eventRides = ridesByKey.getOrDefault(eventKey, List.of());

            List<CarpoolRequestResponse> ownRequests = new ArrayList<>();
            List<CarpoolRequestResponse> otherRequests = new ArrayList<>();
            for (CarpoolRequestEntity request : eventRequests) {
                Set<CarpoolNeededLeg> confirmed = confirmedLegs(request, eventRides);
                CarpoolRequestRideModelService.DerivedRequestStatus derived =
                        modelService.deriveRequestStatus(request.legsNeeded(), confirmed);
                List<CarpoolRequestPassEntity> requestPasses =
                        passesByRequest.getOrDefault(request.id(), List.of());
                boolean own = request.requestingCircleId().equals(circleId);
                boolean passedByMe =
                        !own
                                && requestPasses.stream()
                                        .anyMatch(pass -> pass.adultId().equals(adult.id()));
                Integer detourMinutes =
                        own ? null : detourMinutesByRequestId.get(request.id());
                CarpoolRequestResponse dto =
                        toRequestResponse(
                                request,
                                derived,
                                circleNames,
                                passedByMe,
                                passedByAdultNames(requestPasses, adultDisplayNames),
                                detourMinutes);
                if (own) {
                    ownRequests.add(dto);
                } else {
                    otherRequests.add(dto);
                }
            }

            List<CarpoolRideResponse> rideDtos = new ArrayList<>();
            for (CarpoolRideEntity ride : eventRides) {
                rideDtos.add(toRideResponse(ride, circleNames, vehicleLabels));
            }

            result.add(
                    new CarpoolRideEventResponse(
                            eventKey,
                            event.title(),
                            event.startsAt(),
                            event.endsAt(),
                            defaultKidIds(circleId, event, eventRequests),
                            ownRequests,
                            otherRequests,
                            rideDtos));
        }
        return result;
    }

    @Transactional
    public CarpoolRequestResponse createRequest(
            AdultResponse adult, UUID spaceId, CreateCarpoolRequestRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        FeedCalendarEventDto event =
                findSpaceEvent(circleId, space, request.eventKey())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST, "Unknown event"));
        String eventKey = RideEventKey.of(event);
        Set<CarpoolNeededLeg> legsNeeded =
                modelService.normalizedLegs(request.legs(), request.legsNeeded());
        if (legsNeeded.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "legsNeeded must not be empty");
        }
        modelService.requireUniqueRequest(spaceId, eventKey, request.kidId(), circleId, requests);

        List<CarpoolRequestEntity> existing =
                requests.findBySpaceIdAndEventKeyAndRequestingCircleId(spaceId, eventKey, circleId);
        List<UUID> eligibleKids = defaultKidIds(circleId, event, existing);
        if (!eligibleKids.contains(request.kidId())) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "Kid is not eligible for a ride (RSVP No, unknown, or already requested)");
        }

        CirclePlaceDto pickup =
                familyPlaceApi
                        .findPickupPlaceForMember(adult.id())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST,
                                                "No pickup address; add a home address in Places"));
        List<FamilyKidName> names =
                familyMembershipApi.findKids(circleId, List.of(request.kidId()));
        if (names.size() != 1) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "Kid not found in this circle");
        }
        String kidFirstName = names.get(0).displayName();
        CarpoolRequestEntity created =
                new CarpoolRequestEntity(
                        UUID.randomUUID(),
                        spaceId,
                        eventKey,
                        request.kidId(),
                        kidFirstName,
                        circleId,
                        adult.id(),
                        pickup.name(),
                        pickup.address(),
                        legsNeeded,
                        Instant.now());
        requests.save(created);
        CarpoolRequestRideModelService.DerivedRequestStatus derived =
                modelService.deriveRequestStatus(created.legsNeeded(), Set.of());
        return toRequestResponse(
                created, derived, circleNames(List.of(circleId)), false, List.of(), null);
    }

    @Transactional
    public CarpoolRequestResponse patchRequest(
            AdultResponse adult, UUID spaceId, UUID requestId, PatchCarpoolRequestRequest patch) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRequestEntity request =
                requests.findByIdAndSpaceId(requestId, spaceId).orElseThrow(this::notFound);
        if (!request.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Caller's circle is not the requesting circle");
        }
        Set<CarpoolNeededLeg> nextLegs =
                modelService.normalizedLegs(patch.legs(), patch.legsNeeded());
        if (nextLegs.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "legsNeeded must not be empty");
        }
        request.replaceLegsNeeded(nextLegs);
        requests.save(request);
        List<CarpoolRideEntity> activeRides =
                rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of(request.eventKey()), CarpoolFulfillmentStatus.ACTIVE);
        Set<CarpoolNeededLeg> confirmed = confirmedLegs(request, activeRides);
        CarpoolRequestRideModelService.DerivedRequestStatus derived =
                modelService.deriveRequestStatus(request.legsNeeded(), confirmed);
        return toRequestResponse(
                request, derived, circleNames(List.of(circleId)), false, List.of(), null);
    }

    @Transactional
    public CarpoolRequestResponse pass(AdultResponse adult, UUID spaceId, UUID requestId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRequestEntity request =
                requests.findByIdAndSpaceId(requestId, spaceId).orElseThrow(this::notFound);
        if (request.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Cannot pass on your own circle's request");
        }
        List<CarpoolRideEntity> activeRides =
                rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of(request.eventKey()), CarpoolFulfillmentStatus.ACTIVE);
        Set<CarpoolNeededLeg> open = openLegs(request, activeRides);
        if (open.isEmpty()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Request has no open legs");
        }
        if (!passes.existsByRequestIdAndAdultId(request.id(), adult.id())) {
            passes.save(
                    new CarpoolRequestPassEntity(
                            UUID.randomUUID(), request.id(), adult.id(), Instant.now()));
        }
        List<CarpoolRequestPassEntity> requestPasses =
                passesByRequestId(List.of(request.id())).getOrDefault(request.id(), List.of());
        Map<UUID, String> adultDisplayNames = adultDisplayNames(List.of(requestPasses));
        CarpoolRequestRideModelService.DerivedRequestStatus derived =
                modelService.deriveRequestStatus(
                        request.legsNeeded(), confirmedLegs(request, activeRides));
        return toRequestResponse(
                request,
                derived,
                circleNames(List.of(request.requestingCircleId(), circleId)),
                true,
                passedByAdultNames(requestPasses, adultDisplayNames),
                null);
    }

    @Transactional
    public List<CarpoolRideResponse> accept(
            AdultResponse adult,
            UUID spaceId,
            UUID requestId,
            AcceptCarpoolRequestRequest body) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);

        List<UUID> passengerIds =
                body.passengerRequestIds() == null || body.passengerRequestIds().isEmpty()
                        ? List.of(requestId)
                        : List.copyOf(new LinkedHashSet<>(body.passengerRequestIds()));
        if (!passengerIds.contains(requestId)) {
            passengerIds = new ArrayList<>(passengerIds);
            passengerIds.add(0, requestId);
            passengerIds = List.copyOf(new LinkedHashSet<>(passengerIds));
        }

        List<CarpoolRequestEntity> passengers = loadPassengersInSpace(spaceId, passengerIds);
        CarpoolRequestEntity primary = passengers.get(0);
        UUID requestingCircleId = primary.requestingCircleId();
        String eventKey = primary.eventKey();
        for (CarpoolRequestEntity passenger : passengers) {
            if (!passenger.requestingCircleId().equals(requestingCircleId)) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Passengers must share the same requesting circle");
            }
            if (!passenger.eventKey().equals(eventKey)) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Passengers must share the same event");
            }
        }
        if (requestingCircleId.equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Cannot accept your own circle's request");
        }

        VehicleResponse vehicle = requireDrivableVehicle(adult, circleId, body.vehicleId());

        List<CarpoolRideEntity> activeRides =
                rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of(eventKey), CarpoolFulfillmentStatus.ACTIVE);
        Set<CarpoolNeededLeg> openIntersection = null;
        for (CarpoolRequestEntity passenger : passengers) {
            Set<CarpoolNeededLeg> open = openLegs(passenger, activeRides);
            if (openIntersection == null) {
                openIntersection = new LinkedHashSet<>(open);
            } else {
                openIntersection.retainAll(open);
            }
        }
        if (openIntersection == null || openIntersection.isEmpty()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "No open legs to accept");
        }

        int ownYesKids = yesKidCountOnEvent(circleId, spaceId, eventKey);
        int passengerCount = passengers.size();
        List<CarpoolRideEntity> created = new ArrayList<>();
        Instant now = Instant.now();
        for (CarpoolNeededLeg leg : openIntersection) {
            if (rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                    spaceId, eventKey, vehicle.id(), leg, CarpoolFulfillmentStatus.ACTIVE)) {
                throw new CarpoolException(
                        HttpStatus.CONFLICT, "Vehicle already has an active ride for this leg");
            }
            for (CarpoolRequestEntity passenger : passengers) {
                modelService.requireNoPassengerLegConflict(
                        spaceId, eventKey, passenger.id(), Set.of(leg), rides);
            }
            int remaining = vehicle.seats() - 1 - ownYesKids - passengerCount;
            if (remaining < 0) {
                throw new CarpoolException(HttpStatus.CONFLICT, "Not enough remaining seats");
            }
            Set<UUID> passengerRequestIds =
                    passengers.stream()
                            .map(CarpoolRequestEntity::id)
                            .collect(Collectors.toCollection(LinkedHashSet::new));
            CarpoolRideEntity ride =
                    new CarpoolRideEntity(
                            UUID.randomUUID(),
                            spaceId,
                            eventKey,
                            leg,
                            adult.id(),
                            circleId,
                            vehicle.id(),
                            passengerRequestIds,
                            now);
            rides.save(ride);
            created.add(ride);
        }

        passes.deleteByRequestIdIn(
                passengers.stream().map(CarpoolRequestEntity::id).toList());
        for (CarpoolRequestEntity passenger : passengers) {
            ensureKidYes(passenger, adult.id());
        }
        upsertAcceptedDriverRoute(adult.id(), circleId, spaceId, eventKey);

        Map<UUID, String> names = circleNames(List.of(requestingCircleId, circleId));
        Map<UUID, String> vehicleLabels = Map.of(vehicle.id(), vehicle.label());
        List<CarpoolRideResponse> responses = new ArrayList<>();
        for (CarpoolRideEntity ride : created) {
            responses.add(toRideResponse(ride, names, vehicleLabels));
        }
        return responses;
    }

    @Transactional
    public CarpoolRideResponse createRide(
            AdultResponse adult, UUID spaceId, CreateCarpoolRideRequest body) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        FeedCalendarEventDto event =
                findSpaceEvent(circleId, space, body.eventKey())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST, "Unknown event"));
        String eventKey = RideEventKey.of(event);
        if (body.leg() == null) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "leg is required");
        }

        List<UUID> passengerIds = List.copyOf(new LinkedHashSet<>(body.passengerRequestIds()));
        List<CarpoolRequestEntity> passengers = loadPassengersInSpace(spaceId, passengerIds);
        UUID requestingCircleId = passengers.get(0).requestingCircleId();
        for (CarpoolRequestEntity passenger : passengers) {
            if (!passenger.requestingCircleId().equals(requestingCircleId)) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Passengers must share the same requesting circle");
            }
            if (!passenger.eventKey().equals(eventKey)) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Passengers must share the same event");
            }
            if (!passenger.legsNeeded().contains(body.leg())) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Passenger request does not need this leg");
            }
        }

        VehicleResponse vehicle = requireDrivableVehicle(adult, circleId, body.vehicleId());

        List<CarpoolRideEntity> activeRides =
                rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of(eventKey), CarpoolFulfillmentStatus.ACTIVE);
        for (CarpoolRequestEntity passenger : passengers) {
            if (!openLegs(passenger, activeRides).contains(body.leg())) {
                throw new CarpoolException(
                        HttpStatus.CONFLICT, "Request leg is already assigned on another active ride");
            }
            modelService.requireNoPassengerLegConflict(
                    spaceId, eventKey, passenger.id(), Set.of(body.leg()), rides);
        }
        if (rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                spaceId, eventKey, vehicle.id(), body.leg(), CarpoolFulfillmentStatus.ACTIVE)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Vehicle already has an active ride for this leg");
        }

        int ownYesKids = yesKidCountOnEvent(circleId, spaceId, eventKey);
        int remaining = vehicle.seats() - 1 - ownYesKids - passengers.size();
        if (remaining < 0) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Not enough remaining seats");
        }

        Set<UUID> passengerRequestIds =
                passengers.stream()
                        .map(CarpoolRequestEntity::id)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        CarpoolRideEntity ride =
                new CarpoolRideEntity(
                        UUID.randomUUID(),
                        spaceId,
                        eventKey,
                        body.leg(),
                        adult.id(),
                        circleId,
                        vehicle.id(),
                        passengerRequestIds,
                        Instant.now());
        rides.save(ride);

        for (CarpoolRequestEntity passenger : passengers) {
            ensureKidYes(passenger, adult.id());
        }
        upsertAcceptedDriverRoute(adult.id(), circleId, spaceId, eventKey);

        return toRideResponse(
                ride,
                circleNames(List.of(requestingCircleId, circleId)),
                Map.of(vehicle.id(), vehicle.label()));
    }

    @Transactional
    public CarpoolRideResponse cancel(AdultResponse adult, UUID spaceId, UUID rideId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRideEntity ride =
                rides.findByIdAndSpaceId(rideId, spaceId).orElseThrow(this::notFound);
        List<CarpoolRequestEntity> passengers =
                requests.findByIdIn(ride.passengerRequestIds());
        boolean callerIsPassengerCircle =
                passengers.stream().anyMatch(p -> p.requestingCircleId().equals(circleId));
        if (!callerIsPassengerCircle) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Caller's circle is not a passenger requesting circle");
        }
        if (!ride.isActive()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Ride is not ACTIVE");
        }
        UUID driverId = ride.driverAdultId();
        String eventKey = ride.eventKey();
        ride.cancel();
        rides.save(ride);
        refreshDriverRouteAfterAcceptedChange(driverId, spaceId, eventKey);
        return toRideResponse(
                ride,
                circleNames(List.of(circleId, ride.drivingCircleId())),
                vehicleLabels(Set.of(ride.drivingCircleId())));
    }

    @Transactional
    public CarpoolRideResponse withdraw(AdultResponse adult, UUID spaceId, UUID rideId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        CarpoolRideEntity ride =
                rides.findByIdAndSpaceId(rideId, spaceId).orElseThrow(this::notFound);
        if (!ride.drivingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Caller's circle is not the driving circle");
        }
        if (!ride.isActive()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Ride is not ACTIVE");
        }
        UUID driverId = ride.driverAdultId();
        String eventKey = ride.eventKey();
        ride.withdraw();
        rides.save(ride);
        refreshDriverRouteAfterAcceptedChange(driverId, spaceId, eventKey);
        return toRideResponse(
                ride,
                circleNames(List.of(circleId)),
                vehicleLabels(Set.of(circleId)));
    }

    /**
     * Same-transaction side effect of removing CONFIRMED coverage: withdraw every
     * ACTIVE inbound ride on this feed event when this circle was the driver.
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
        List<CarpoolRideEntity> active =
                rides.findBySpaceIdInAndEventKeyAndDrivingCircleIdAndStatus(
                        spaceIds, eventKey, circleId, CarpoolFulfillmentStatus.ACTIVE);
        for (CarpoolRideEntity ride : active) {
            UUID driverId = ride.driverAdultId();
            ride.withdraw();
            rides.save(ride);
            if (driverId != null) {
                refreshDriverRouteAfterAcceptedChange(driverId, ride.spaceId(), eventKey);
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
        List<CarpoolRideEntity> active =
                rides.findBySpaceIdInAndEventKeyAndStatus(
                        spaceIds, eventKey, CarpoolFulfillmentStatus.ACTIVE);
        Set<UUID> passengerIds = new HashSet<>();
        for (CarpoolRideEntity ride : active) {
            passengerIds.addAll(ride.passengerRequestIds());
        }
        Map<UUID, CarpoolRequestEntity> requestsById =
                passengerIds.isEmpty()
                        ? Map.of()
                        : requests.findByIdIn(passengerIds).stream()
                                .collect(Collectors.toMap(CarpoolRequestEntity::id, r -> r));

        List<CarpoolAcceptedPickupDto> out = new ArrayList<>();
        for (CarpoolRideEntity ride : active) {
            List<CarpoolRequestEntity> passengers = new ArrayList<>();
            for (UUID passengerId : ride.passengerRequestIds()) {
                CarpoolRequestEntity request = requestsById.get(passengerId);
                if (request != null) {
                    passengers.add(request);
                }
            }
            if (passengers.isEmpty()) {
                continue;
            }
            boolean driving = circleId.equals(ride.drivingCircleId());
            boolean requesting =
                    passengers.stream().anyMatch(p -> circleId.equals(p.requestingCircleId()));
            if (!driving && !requesting) {
                continue;
            }
            CarpoolRequestEntity first = passengers.get(0);
            out.add(
                    new CarpoolAcceptedPickupDto(
                            ride.driverAdultId(),
                            ride.drivingCircleId(),
                            first.requestingCircleId(),
                            first.pickupPlaceName(),
                            first.pickupAddress(),
                            passengers.stream().map(CarpoolRequestEntity::kidId).toList()));
        }
        return List.copyOf(out);
    }

    private void upsertAcceptedDriverRoute(
            UUID driverAdultId, UUID drivingCircleId, UUID spaceId, String eventKey) {
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElse(null);
        if (space == null) {
            return;
        }
        Optional<FeedCalendarEventDto> event = findSpaceEvent(drivingCircleId, space, eventKey);
        if (event.isEmpty()) {
            return;
        }
        List<CalendarRoutePickupInput> pickups =
                pickupsForDriver(driverAdultId, spaceId, eventKey);
        if (pickups.isEmpty()) {
            leaveByApi.invalidateCalendarRoute(
                    driverAdultId, LeaveByItemSource.FEED, event.get().id());
            return;
        }
        leaveByApi.upsertCalendarRoute(
                driverAdultId,
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
        List<CarpoolRideEntity> active =
                rides.findBySpaceIdInAndEventKeyAndDriverAdultIdAndStatus(
                        List.of(spaceId),
                        eventKey,
                        drivingAdultId,
                        CarpoolFulfillmentStatus.ACTIVE);
        List<CarpoolRideEntity> toRides =
                active.stream().filter(ride -> ride.leg() == CarpoolNeededLeg.TO).toList();
        if (toRides.isEmpty()) {
            return List.of();
        }
        Set<UUID> passengerIds = new HashSet<>();
        for (CarpoolRideEntity ride : toRides) {
            passengerIds.addAll(ride.passengerRequestIds());
        }
        Map<UUID, CarpoolRequestEntity> byId =
                requests.findByIdIn(passengerIds).stream()
                        .collect(Collectors.toMap(CarpoolRequestEntity::id, r -> r));
        Map<UUID, String> names =
                circleNames(
                        byId.values().stream()
                                .map(CarpoolRequestEntity::requestingCircleId)
                                .distinct()
                                .toList());
        List<CalendarRoutePickupInput> pickups = new ArrayList<>();
        Set<UUID> seenRequestIds = new HashSet<>();
        for (CarpoolRideEntity ride : toRides) {
            for (UUID passengerId : ride.passengerRequestIds()) {
                if (!seenRequestIds.add(passengerId)) {
                    continue;
                }
                CarpoolRequestEntity request = byId.get(passengerId);
                if (request == null) {
                    continue;
                }
                String to = names.get(request.requestingCircleId());
                if (to == null || to.isBlank()) {
                    to = request.pickupPlaceName();
                }
                if (to == null || to.isBlank()) {
                    to = "Family";
                }
                pickups.add(
                        new CalendarRoutePickupInput(
                                request.pickupPlaceName(),
                                request.pickupAddress(),
                                new CalendarRouteNotifyContact(
                                        CalendarRouteNotifyChannel.PUSH, to)));
            }
        }
        return pickups;
    }

    private static String destinationName(FeedCalendarEventDto event) {
        if (event.location() != null && !event.location().isBlank()) {
            return event.location();
        }
        return event.title();
    }

    private List<UUID> defaultKidIds(
            UUID circleId,
            FeedCalendarEventDto event,
            List<CarpoolRequestEntity> existingRequests) {
        List<UUID> feedKids = event.kidIds() == null ? List.of() : event.kidIds();
        if (feedKids.isEmpty()) {
            return List.of();
        }
        Map<UUID, RsvpStatus> byKid =
                rsvpApi.statusesForKids(circleId, RsvpItemSource.FEED, event.id(), feedKids).stream()
                        .collect(
                                Collectors.toMap(
                                        RsvpDto::kidId, RsvpDto::status, (left, right) -> left));
        Set<UUID> requestedKidIds =
                existingRequests.stream()
                        .filter(r -> r.requestingCircleId().equals(circleId))
                        .map(CarpoolRequestEntity::kidId)
                        .collect(Collectors.toSet());
        return feedKids.stream()
                .filter(kidId -> byKid.getOrDefault(kidId, RsvpStatus.NO_RESPONSE) != RsvpStatus.NO)
                .filter(kidId -> !requestedKidIds.contains(kidId))
                .distinct()
                .toList();
    }

    private void ensureKidYes(CarpoolRequestEntity request, UUID updatedByAdultId) {
        CarpoolSpaceEntity space = spaces.findById(request.spaceId()).orElseThrow(this::notFound);
        FeedCalendarEventDto event =
                findSpaceEvent(request.requestingCircleId(), space, request.eventKey())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST,
                                                "Unknown event for requesting circle"));
        rsvpApi.setStatus(
                request.requestingCircleId(),
                RsvpItemSource.FEED,
                event.id(),
                request.kidId(),
                RsvpStatus.YES,
                updatedByAdultId);
    }

    private int yesKidCountOnEvent(UUID circleId, UUID spaceId, String eventKey) {
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElseThrow(this::notFound);
        return findSpaceEvent(circleId, space, eventKey)
                .map(
                        event -> {
                            List<UUID> feedKids =
                                    event.kidIds() == null ? List.of() : event.kidIds();
                            if (feedKids.isEmpty()) {
                                return 0;
                            }
                            return (int)
                                    rsvpApi
                                            .statusesForKids(
                                                    circleId,
                                                    RsvpItemSource.FEED,
                                                    event.id(),
                                                    feedKids)
                                            .stream()
                                            .filter(row -> row.status() == RsvpStatus.YES)
                                            .count();
                        })
                .orElse(0);
    }

    private List<CarpoolRequestEntity> loadPassengersInSpace(
            UUID spaceId, List<UUID> passengerIds) {
        if (passengerIds.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "passengerRequestIds must not be empty");
        }
        List<CarpoolRequestEntity> found = requests.findByIdIn(passengerIds);
        Map<UUID, CarpoolRequestEntity> byId =
                found.stream().collect(Collectors.toMap(CarpoolRequestEntity::id, r -> r));
        List<CarpoolRequestEntity> ordered = new ArrayList<>();
        for (UUID id : passengerIds) {
            CarpoolRequestEntity request = byId.get(id);
            if (request == null || !request.spaceId().equals(spaceId)) {
                throw notFound();
            }
            ordered.add(request);
        }
        return ordered;
    }

    private VehicleResponse requireDrivableVehicle(
            AdultResponse adult, UUID circleId, UUID vehicleId) {
        GarageResponse garage = familyGarageApi.garageForCircle(circleId);
        boolean drives =
                garage.members().stream()
                        .filter(member -> member.adultId().equals(adult.id()))
                        .findFirst()
                        .map(GarageMemberDrivesResponse::drives)
                        .orElse(true);
        if (!drives) {
            throw new CarpoolException(HttpStatus.FORBIDDEN, "Caller has drives=false");
        }
        VehicleResponse vehicle =
                garage.vehicles().stream()
                        .filter(row -> row.id().equals(vehicleId))
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.NOT_FOUND, "Vehicle not found"));
        if (!vehicle.driverAdultIds().contains(adult.id())) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
        return vehicle;
    }

    private static Set<CarpoolNeededLeg> confirmedLegs(
            CarpoolRequestEntity request, List<CarpoolRideEntity> activeRides) {
        Set<CarpoolNeededLeg> confirmed = new LinkedHashSet<>();
        for (CarpoolRideEntity ride : activeRides) {
            if (ride.passengerRequestIds().contains(request.id())
                    && request.legsNeeded().contains(ride.leg())) {
                confirmed.add(ride.leg());
            }
        }
        return confirmed;
    }

    private static Set<CarpoolNeededLeg> openLegs(
            CarpoolRequestEntity request, List<CarpoolRideEntity> activeRides) {
        Set<CarpoolNeededLeg> open = new LinkedHashSet<>(request.legsNeeded());
        open.removeAll(confirmedLegs(request, activeRides));
        return open;
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

    private CarpoolRequestResponse toRequestResponse(
            CarpoolRequestEntity request,
            CarpoolRequestRideModelService.DerivedRequestStatus derived,
            Map<UUID, String> circleNames,
            boolean passedByMe,
            List<String> passedByAdultNames,
            Integer detourMinutes) {
        return new CarpoolRequestResponse(
                request.id(),
                request.spaceId(),
                request.eventKey(),
                request.requestingCircleId(),
                circleNames.get(request.requestingCircleId()),
                request.createdByAdultId(),
                request.kidId(),
                request.kidFirstName(),
                List.copyOf(request.legsNeeded()),
                derived.legStatuses(),
                request.pickupPlaceName(),
                request.pickupAddress(),
                PickupTownParser.pickupTownFromAddress(request.pickupAddress()),
                detourMinutes,
                derived.rollup(),
                passedByMe,
                List.copyOf(passedByAdultNames));
    }

    private CarpoolRideResponse toRideResponse(
            CarpoolRideEntity ride,
            Map<UUID, String> circleNames,
            Map<UUID, String> vehicleLabels) {
        return new CarpoolRideResponse(
                ride.id(),
                ride.spaceId(),
                ride.eventKey(),
                ride.leg(),
                ride.driverAdultId(),
                ride.drivingCircleId(),
                circleNames.get(ride.drivingCircleId()),
                ride.vehicleId(),
                vehicleLabels.get(ride.vehicleId()),
                List.copyOf(ride.passengerRequestIds()),
                ride.status());
    }

    private Map<UUID, Integer> detourMinutesByRequestId(
            UUID adultId, List<UUID> requestIds, List<DetourItemInput> items) {
        if (requestIds.isEmpty()) {
            return Map.of();
        }
        List<Integer> minutes = leaveByApi.detourMinutesMany(adultId, items);
        Map<UUID, Integer> byRequestId = new HashMap<>();
        for (int i = 0; i < requestIds.size(); i++) {
            byRequestId.put(requestIds.get(i), minutes.get(i));
        }
        return byRequestId;
    }

    private Map<UUID, List<CarpoolRequestPassEntity>> passesByRequestId(
            Collection<UUID> requestIds) {
        if (requestIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<CarpoolRequestPassEntity>> byRequest = new HashMap<>();
        for (CarpoolRequestPassEntity pass : passes.findByRequestIdIn(requestIds)) {
            byRequest.computeIfAbsent(pass.requestId(), ignored -> new ArrayList<>()).add(pass);
        }
        for (List<CarpoolRequestPassEntity> group : byRequest.values()) {
            group.sort(Comparator.comparing(CarpoolRequestPassEntity::createdAt));
        }
        return byRequest;
    }

    private Map<UUID, String> adultDisplayNames(
            Collection<List<CarpoolRequestPassEntity>> passGroups) {
        Set<UUID> adultIds = new HashSet<>();
        for (List<CarpoolRequestPassEntity> group : passGroups) {
            for (CarpoolRequestPassEntity pass : group) {
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
            List<CarpoolRequestPassEntity> requestPasses, Map<UUID, String> adultDisplayNames) {
        if (requestPasses.isEmpty()) {
            return List.of();
        }
        List<String> names = new ArrayList<>(requestPasses.size());
        for (CarpoolRequestPassEntity pass : requestPasses) {
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

    private Map<UUID, String> vehicleLabels(Set<UUID> circleIds) {
        Map<UUID, String> labels = new HashMap<>();
        for (UUID circleId : circleIds) {
            if (circleId == null) {
                continue;
            }
            for (VehicleResponse vehicle : familyGarageApi.garageForCircle(circleId).vehicles()) {
                labels.put(vehicle.id(), vehicle.label());
            }
        }
        return labels;
    }

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
