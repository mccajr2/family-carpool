package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolRideEventResponse;
import com.yourorg.quickapp.carpool.CarpoolRideLegResponse;
import com.yourorg.quickapp.carpool.CarpoolRideResponse;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import com.yourorg.quickapp.carpool.CreateCarpoolRideRequest;
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
    private static final List<CarpoolRideStatus> ACTIVE =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED);

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
                                ACTIVE)
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
                FeedCalendarEventDto event = eventsByKey.get(ride.eventKey());
                String eventLocation = event == null ? null : event.location();
                detourItems.add(new DetourItemInput(ride.pickupAddress(), eventLocation));
                detourRideIds.add(ride.id());
            }
        }
        Map<UUID, Integer> detourMinutesByRideId = detourMinutesByRideId(adult.id(), detourRideIds, detourItems);
        List<CarpoolRideEventResponse> result = new ArrayList<>();
        for (FeedCalendarEventDto event : events) {
            String eventKey = RideEventKey.of(event);
            List<CarpoolRideRequestEntity> overlay = ridesByKey.getOrDefault(eventKey, List.of());
            CarpoolRideResponse own = null;
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
                    own = dto;
                } else {
                    others.add(dto);
                }
            }
            result.add(
                    new CarpoolRideEventResponse(
                            eventKey,
                            event.title(),
                            event.startsAt(),
                            event.endsAt(),
                            defaultKidIds(circleId, spaceId, event),
                            own == null
                                    ? needsRideOwnLegs()
                                    : own.legs(),
                            own,
                            others));
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
        if (rides.existsBySpaceIdAndEventKeyAndRequestingCircleIdAndStatusIn(
                spaceId, eventKey, circleId, ACTIVE)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT,
                    "An active ride request from this circle already exists for this event");
        }
        CirclePlaceDto pickup =
                familyPlaceApi
                        .findPickupPlaceForMember(adult.id())
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.BAD_REQUEST,
                                                "No pickup address; add a home address in Places"));
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
                        pickup.name(),
                        pickup.address(),
                        snapshots,
                        askedLegs,
                        Instant.now());
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
        ride.accept(adult.id(), circleId);
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
                && ride.status() != CarpoolRideStatus.ACCEPTED) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Ride is not PENDING or ACCEPTED");
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
            out.add(
                    new CarpoolAcceptedPickupDto(
                            ride.acceptedByAdultId(),
                            ride.acceptingCircleId(),
                            ride.requestingCircleId(),
                            ride.pickupPlaceName(),
                            ride.pickupAddress(),
                            ride.kids().stream().map(RideKidSnapshot::kidId).toList()));
        }
        return List.copyOf(out);
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
        if (pickups.isEmpty()) {
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
        Map<UUID, String> names =
                circleNames(
                        accepted.stream()
                                .map(CarpoolRideRequestEntity::requestingCircleId)
                                .distinct()
                                .toList());
        List<CalendarRoutePickupInput> pickups = new ArrayList<>();
        for (CarpoolRideRequestEntity ride : accepted) {
            String to = names.get(ride.requestingCircleId());
            if (to == null || to.isBlank()) {
                to = ride.pickupPlaceName();
            }
            if (to == null || to.isBlank()) {
                to = "Family";
            }
            pickups.add(
                    new CalendarRoutePickupInput(
                            ride.pickupPlaceName(),
                            ride.pickupAddress(),
                            new CalendarRouteNotifyContact(CalendarRouteNotifyChannel.PUSH, to)));
        }
        return pickups;
    }

    private CalendarRoutePickupInput toPickupInput(CarpoolRideRequestEntity ride) {
        String to =
                familyMembershipApi
                        .findCircle(ride.requestingCircleId())
                        .map(FamilyCircleName::name)
                        .filter(name -> name != null && !name.isBlank())
                        .orElse(ride.pickupPlaceName());
        if (to == null || to.isBlank()) {
            to = "Family";
        }
        return new CalendarRoutePickupInput(
                ride.pickupPlaceName(),
                ride.pickupAddress(),
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
                                    : circleNames.get(leg.assigneeCircleId())));
        }
        return List.copyOf(out);
    }

    private static List<CarpoolRideLegResponse> needsRideOwnLegs() {
        return List.of(
                new CarpoolRideLegResponse(
                        CarpoolLegKind.TO, CarpoolLegPhase.NEEDS_RIDE, null, null, null, null),
                new CarpoolRideLegResponse(
                        CarpoolLegKind.FROM, CarpoolLegPhase.NEEDS_RIDE, null, null, null, null));
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
     *     (CONFIRMED only when choosing combined/per-leg)
     */
    private Set<CarpoolLegKind> resolveClearLegs(
            CarpoolRideRequestEntity ride, List<CarpoolLegKind> requestedLegs, boolean cancelMode) {
        if (requestedLegs == null || requestedLegs.isEmpty()) {
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
                if (ride.leg(kind).phase() != CarpoolLegPhase.CONFIRMED) {
                    throw new CarpoolException(
                            HttpStatus.CONFLICT, "Can only withdraw confirmed legs");
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
