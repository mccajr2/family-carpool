package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.AcceptCarpoolRideRequest;
import com.yourorg.quickapp.carpool.CarpoolRideEventResponse;
import com.yourorg.quickapp.carpool.CarpoolRideResponse;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import com.yourorg.quickapp.carpool.CreateCarpoolRideRequest;
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
    private static final List<CarpoolRideStatus> ACTIVE =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED);

    private final AdultSessionApi adultSessionApi;
    private final FamilyMembershipApi familyMembershipApi;
    private final FamilyPlaceApi familyPlaceApi;
    private final FamilyGarageApi familyGarageApi;
    private final FeedsApi feedsApi;
    private final FeedCalendarApi feedCalendarApi;
    private final RsvpApi rsvpApi;
    private final CarpoolSpaceRepository spaces;
    private final CarpoolMembershipRepository memberships;
    private final CarpoolRideRequestRepository rides;
    private final CarpoolRidePassRepository passes;

    public CarpoolRideService(
            AdultSessionApi adultSessionApi,
            FamilyMembershipApi familyMembershipApi,
            FamilyPlaceApi familyPlaceApi,
            FamilyGarageApi familyGarageApi,
            FeedsApi feedsApi,
            FeedCalendarApi feedCalendarApi,
            RsvpApi rsvpApi,
            CarpoolSpaceRepository spaces,
            CarpoolMembershipRepository memberships,
            CarpoolRideRequestRepository rides,
            CarpoolRidePassRepository passes) {
        this.adultSessionApi = adultSessionApi;
        this.familyMembershipApi = familyMembershipApi;
        this.familyPlaceApi = familyPlaceApi;
        this.familyGarageApi = familyGarageApi;
        this.feedsApi = feedsApi;
        this.feedCalendarApi = feedCalendarApi;
        this.rsvpApi = rsvpApi;
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
        Set<UUID> vehicleCircleIds = new HashSet<>();
        for (List<CarpoolRideRequestEntity> group : ridesByKey.values()) {
            for (CarpoolRideRequestEntity ride : group) {
                circleIds.add(ride.requestingCircleId());
                if (ride.acceptingCircleId() != null) {
                    circleIds.add(ride.acceptingCircleId());
                    vehicleCircleIds.add(ride.acceptingCircleId());
                }
            }
        }
        Map<UUID, String> circleNames = circleNames(circleIds);
        Map<UUID, String> vehicleLabels = vehicleLabels(vehicleCircleIds);
        Set<UUID> listedRideIds =
                ridesByKey.values().stream()
                        .flatMap(List::stream)
                        .map(CarpoolRideRequestEntity::id)
                        .collect(Collectors.toSet());
        Map<UUID, List<CarpoolRidePassEntity>> passesByRide = passesByRideId(listedRideIds);
        Map<UUID, String> adultDisplayNames = adultDisplayNames(passesByRide.values());
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
                CarpoolRideResponse dto =
                        toRideResponse(
                                ride,
                                circleNames,
                                vehicleLabels,
                                passedByMe,
                                passedByAdultNames(ridePasses, adultDisplayNames));
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
                        Instant.now());
        rides.save(created);
        return toRideResponse(
                created,
                circleNames(List.of(circleId)),
                Map.of(),
                false,
                List.of());
    }

    @Transactional
    public CarpoolRideResponse accept(
            AdultResponse adult, UUID spaceId, UUID rideId, AcceptCarpoolRideRequest request) {
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
                        .filter(row -> row.id().equals(request.vehicleId()))
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.NOT_FOUND, "Vehicle not found"));
        if (!vehicle.driverAdultIds().contains(adult.id())) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
        if (rides.existsBySpaceIdAndEventKeyAndVehicleIdAndStatus(
                spaceId, ride.eventKey(), vehicle.id(), CarpoolRideStatus.ACCEPTED)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Vehicle already has an accepted ride for this event");
        }
        int ownYesKids = yesKidCountOnEvent(circleId, spaceId, ride.eventKey());
        int remaining = vehicle.seats() - 1 - ownYesKids;
        if (remaining < ride.seats()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Not enough remaining seats");
        }
        ride.accept(adult.id(), circleId, vehicle.id());
        rides.save(ride);
        passes.deleteByRideId(ride.id());
        ensureRequestingKidsYes(ride, adult.id());
        Map<UUID, String> names = circleNames(List.of(ride.requestingCircleId(), circleId));
        return toRideResponse(
                ride, names, Map.of(vehicle.id(), vehicle.label()), false, List.of());
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
                Map.of(),
                true,
                passedByAdultNames(ridePasses, adultDisplayNames));
    }

    @Transactional
    public CarpoolRideResponse cancel(AdultResponse adult, UUID spaceId, UUID rideId) {
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
        ride.cancel();
        rides.save(ride);
        passes.deleteByRideId(ride.id());
        return toRideResponse(
                ride, circleNames(List.of(circleId)), Map.of(), false, List.of());
    }

    @Transactional
    public CarpoolRideResponse withdraw(AdultResponse adult, UUID spaceId, UUID rideId) {
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
        ride.withdraw();
        rides.save(ride);
        return toRideResponse(
                ride,
                circleNames(List.of(ride.requestingCircleId(), circleId)),
                Map.of(),
                false,
                List.of());
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
            ride.withdraw();
            rides.save(ride);
        }
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
            Map<UUID, String> vehicleLabels,
            boolean passedByMe,
            List<String> passedByAdultNames) {
        List<UUID> kidIds = ride.kids().stream().map(RideKidSnapshot::kidId).toList();
        List<String> firstNames = ride.kids().stream().map(RideKidSnapshot::firstName).toList();
        String vehicleLabel =
                ride.vehicleId() == null ? null : vehicleLabels.get(ride.vehicleId());
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
                passedByMe,
                List.copyOf(passedByAdultNames),
                ride.acceptedByAdultId(),
                ride.acceptingCircleId(),
                ride.acceptingCircleId() == null ? null : circleNames.get(ride.acceptingCircleId()),
                ride.vehicleId(),
                vehicleLabel);
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
