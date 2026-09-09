package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.AcceptCarpoolRequestRequest;
import com.yourorg.quickapp.carpool.CarpoolFulfillmentStatus;
import com.yourorg.quickapp.carpool.CarpoolLeg;
import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
import com.yourorg.quickapp.carpool.CarpoolRequestStatus;
import com.yourorg.quickapp.carpool.CarpoolSpaceMembership;
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
import com.yourorg.quickapp.leaveby.CalendarRouteDto;
import com.yourorg.quickapp.leaveby.DetourItemInput;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class CarpoolRideServiceTest {

    @Mock
    private AdultSessionApi adultSessionApi;

    @Mock
    private FamilyMembershipApi familyMembershipApi;

    @Mock
    private FamilyPlaceApi familyPlaceApi;

    @Mock
    private FamilyGarageApi familyGarageApi;

    @Mock
    private FeedsApi feedsApi;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private RsvpApi rsvpApi;

    @Mock
    private LeaveByApi leaveByApi;

    @Mock
    private CarpoolSpaceRepository spaces;

    @Mock
    private CarpoolMembershipRepository memberships;

    @Mock
    private CarpoolRequestRepository requests;

    @Mock
    private CarpoolRideRepository rides;

    @Mock
    private CarpoolRequestPassRepository passes;

    private CarpoolRideService service;

    private final UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000001");
    private final UUID otherAdultId = UUID.fromString("01900000-0000-7000-8000-000000000002");
    private final UUID circleId = UUID.fromString("01900000-0000-7000-8000-000000000010");
    private final UUID otherCircleId = UUID.fromString("01900000-0000-7000-8000-000000000011");
    private final UUID feedId = UUID.fromString("01900000-0000-7000-8000-000000000041");
    private final UUID spaceId = UUID.fromString("01900000-0000-7000-8000-000000000080");
    private final UUID eventId = UUID.fromString("01900000-0000-7000-8000-000000000061");
    private final UUID requestingEventId = UUID.fromString("01900000-0000-7000-8000-000000000062");
    private final UUID kidA = UUID.fromString("01900000-0000-7000-8000-000000000021");
    private final UUID kidB = UUID.fromString("01900000-0000-7000-8000-000000000022");
    private final UUID vehicleId = UUID.fromString("01900000-0000-7000-8000-000000000071");
    private final AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
    private final FeedResponse feed =
            new FeedResponse(
                    feedId,
                    "Soccer",
                    "https://example.com/team.ics",
                    List.of(kidA, kidB),
                    Instant.parse("2026-08-01T00:00:00Z"),
                    null,
                    2);

    private final List<CarpoolRideEntity> savedRides = new ArrayList<>();

    @BeforeEach
    void setUp() {
        savedRides.clear();
        service =
                new CarpoolRideService(
                        adultSessionApi,
                        familyMembershipApi,
                        familyPlaceApi,
                        familyGarageApi,
                        feedsApi,
                        feedCalendarApi,
                        rsvpApi,
                        leaveByApi,
                        spaces,
                        memberships,
                        requests,
                        rides,
                        passes,
                        new CarpoolRequestRideModelService());
        org.mockito.Mockito.lenient()
                .when(leaveByApi.detourMinutesMany(any(), any()))
                .thenAnswer(
                        invocation -> {
                            List<?> items = invocation.getArgument(1);
                            return Collections.nCopies(items.size(), null);
                        });
        org.mockito.Mockito.lenient()
                .when(
                        leaveByApi.upsertCalendarRoute(
                                any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(CalendarRouteDto.unavailable("NO_ORIGIN", 0, List.of()));
        org.mockito.Mockito.lenient()
                .when(rides.findBySpaceIdInAndEventKeyAndDriverAdultIdAndStatus(
                        any(), any(), any(), any()))
                .thenAnswer(
                        inv ->
                                savedRides.stream()
                                        .filter(CarpoolRideEntity::isActive)
                                        .filter(r -> r.driverAdultId().equals(inv.getArgument(2)))
                                        .toList());
        org.mockito.Mockito.lenient()
                .when(rides.findBySpaceIdInAndEventKeyAndStatus(any(), any(), any()))
                .thenReturn(List.of());
        org.mockito.Mockito.lenient()
                .when(rides.save(any(CarpoolRideEntity.class)))
                .thenAnswer(
                        inv -> {
                            CarpoolRideEntity ride = inv.getArgument(0);
                            savedRides.removeIf(r -> r.id().equals(ride.id()));
                            savedRides.add(ride);
                            return ride;
                        });
    }

    @Test
    void listRejectsInvertedAndOverlongRange() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        assertThatThrownBy(
                        () ->
                                service.list(
                                        adult, spaceId, from, Instant.parse("2026-08-01T00:00:00Z")))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThatThrownBy(
                        () ->
                                service.list(
                                        adult, spaceId, from, Instant.parse("2026-09-02T00:00:00Z")))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void list404WhenNotMember() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.list(
                                        adult,
                                        spaceId,
                                        Instant.parse("2026-08-01T00:00:00Z"),
                                        Instant.parse("2026-08-31T00:00:00Z")))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void createRequestDefaultsLegsToAndFromAndCreatesOneKidRequest() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(
                List.of(
                        yes(kidA),
                        new RsvpDto(RsvpItemSource.FEED, eventId, kidB, RsvpStatus.NO_RESPONSE)));
        when(requests.findBySpaceIdAndEventKeyAndRequestingCircleId(
                        spaceId, "UID:game-1", circleId))
                .thenReturn(List.of());
        when(requests.existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
                        spaceId, "UID:game-1", kidA, circleId))
                .thenReturn(false);
        stubPickup();
        stubKidNames();
        when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.createRequest(
                        adult,
                        spaceId,
                        new CreateCarpoolRequestRequest("UID:game-1", kidA, null, null));

        assertThat(created.status()).isEqualTo(CarpoolRequestStatus.UNCOVERED);
        assertThat(created.kidId()).isEqualTo(kidA);
        assertThat(created.kidFirstName()).isEqualTo("Sam");
        assertThat(created.legsNeeded())
                .containsExactlyInAnyOrder(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
        assertThat(created.pickupPlaceName()).isEqualTo("Home");
        ArgumentCaptor<CarpoolRequestEntity> saved =
                ArgumentCaptor.forClass(CarpoolRequestEntity.class);
        verify(requests).save(saved.capture());
        assertThat(saved.getValue().eventKey()).isEqualTo("UID:game-1");
        assertThat(saved.getValue().legsNeeded())
                .containsExactlyInAnyOrder(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void createRequest409WhenDuplicate() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        when(requests.existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
                        spaceId, "UID:game-1", kidA, circleId))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.createRequest(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRequestRequest(
                                                "UID:game-1", kidA, null, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(requests, never()).save(any());
    }

    @Test
    void createRequest400WhenNoPickup() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(requests.findBySpaceIdAndEventKeyAndRequestingCircleId(
                        spaceId, "UID:game-1", circleId))
                .thenReturn(List.of());
        when(requests.existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
                        spaceId, "UID:game-1", kidA, circleId))
                .thenReturn(false);
        when(familyPlaceApi.findPickupPlaceForMember(adultId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.createRequest(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRequestRequest(
                                                "UID:game-1", kidA, null, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(requests, never()).save(any());
    }

    @Test
    void createRequest400WhenIneligibleKid() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(
                List.of(
                        new RsvpDto(RsvpItemSource.FEED, eventId, kidA, RsvpStatus.NO),
                        yes(kidB)));
        when(requests.findBySpaceIdAndEventKeyAndRequestingCircleId(
                        spaceId, "UID:game-1", circleId))
                .thenReturn(List.of());
        when(requests.existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
                        spaceId, "UID:game-1", kidA, circleId))
                .thenReturn(false);

        assertThatThrownBy(
                        () ->
                                service.createRequest(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRequestRequest(
                                                "UID:game-1", kidA, null, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(requests, never()).save(any());
    }

    @Test
    void patchRequestUpdatesLegsNeededAnd403WrongCircle() {
        CarpoolRequestEntity own = request(circleId, adultId, kidA, bothLegs(), "1 Main St");
        stubMemberSpace();
        when(requests.findByIdAndSpaceId(own.id(), spaceId)).thenReturn(Optional.of(own));
        when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of());
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var patched =
                service.patchRequest(
                        adult,
                        spaceId,
                        own.id(),
                        new PatchCarpoolRequestRequest(CarpoolLeg.TO, null));

        assertThat(patched.legsNeeded()).containsExactly(CarpoolNeededLeg.TO);
        assertThat(patched.status()).isEqualTo(CarpoolRequestStatus.UNCOVERED);
        assertThat(own.legsNeeded()).containsExactly(CarpoolNeededLeg.TO);

        CarpoolRequestEntity other = request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        when(requests.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));

        assertThatThrownBy(
                        () ->
                                service.patchRequest(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new PatchCarpoolRequestRequest(CarpoolLeg.FROM, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void acceptCreatesToAndFromRidesSeatMathSetsRsvpDeletesPasses() {
        CarpoolRequestEntity pending =
                request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        stubMemberSpace();
        when(requests.findByIdIn(List.of(pending.id()))).thenReturn(List.of(pending));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of());
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                        eq(spaceId),
                        eq("UID:game-1"),
                        eq(vehicleId),
                        any(),
                        eq(CarpoolFulfillmentStatus.ACTIVE)))
                .thenReturn(false);
        when(rides.existsActivePassengerAssignment(
                        eq(spaceId),
                        eq("UID:game-1"),
                        any(),
                        eq(CarpoolFulfillmentStatus.ACTIVE),
                        eq(pending.id())))
                .thenReturn(false);
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        stubRequestingCircleEvent(pending);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));

        var accepted =
                service.accept(
                        adult,
                        spaceId,
                        pending.id(),
                        new AcceptCarpoolRequestRequest(vehicleId, null));

        assertThat(accepted).hasSize(2);
        assertThat(accepted)
                .extracting(r -> r.leg())
                .containsExactlyInAnyOrder(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
        assertThat(accepted)
                .allSatisfy(
                        ride -> {
                            assertThat(ride.status()).isEqualTo(CarpoolFulfillmentStatus.ACTIVE);
                            assertThat(ride.driverAdultId()).isEqualTo(adultId);
                            assertThat(ride.drivingCircleId()).isEqualTo(circleId);
                            assertThat(ride.vehicleId()).isEqualTo(vehicleId);
                            assertThat(ride.passengerRequestIds()).containsExactly(pending.id());
                        });
        verify(rides, times(2)).save(any(CarpoolRideEntity.class));
        verify(passes).deleteByRequestIdIn(List.of(pending.id()));
        verify(rsvpApi)
                .setStatus(
                        otherCircleId,
                        RsvpItemSource.FEED,
                        requestingEventId,
                        kidA,
                        RsvpStatus.YES,
                        adultId);
    }

    @Test
    void acceptOwnCircle409DrivesFalse403NotEnoughSeats409UnknownVehicle404() {
        CarpoolRequestEntity own = request(circleId, adultId, kidA, bothLegs(), "1 Main St");
        stubMemberSpace();
        when(requests.findByIdIn(List.of(own.id()))).thenReturn(List.of(own));

        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        own.id(),
                                        new AcceptCarpoolRequestRequest(vehicleId, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        CarpoolRequestEntity other =
                request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        when(requests.findByIdIn(List.of(other.id()))).thenReturn(List.of(other));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(false, 7, List.of(adultId)));

        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new AcceptCarpoolRequestRequest(vehicleId, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);

        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 2, List.of(adultId)));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of());
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                        eq(spaceId),
                        eq("UID:game-1"),
                        eq(vehicleId),
                        any(),
                        eq(CarpoolFulfillmentStatus.ACTIVE)))
                .thenReturn(false);
        when(rides.existsActivePassengerAssignment(
                        eq(spaceId),
                        eq("UID:game-1"),
                        any(),
                        eq(CarpoolFulfillmentStatus.ACTIVE),
                        eq(other.id())))
                .thenReturn(false);
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(List.of(yes(kidA), yes(kidB)));

        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new AcceptCarpoolRequestRequest(vehicleId, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));
        UUID unknown = UUID.fromString("01900000-0000-7000-8000-000000000099");
        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new AcceptCarpoolRequestRequest(unknown, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void acceptOnlyOpenLegsWhenPartialCoverage() {
        CarpoolRequestEntity pending =
                request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        CarpoolRideEntity existingTo =
                activeRide(CarpoolNeededLeg.TO, adultId, circleId, Set.of(pending.id()));
        stubMemberSpace();
        when(requests.findByIdIn(List.of(pending.id()))).thenReturn(List.of(pending));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of(existingTo));
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                        spaceId,
                        "UID:game-1",
                        vehicleId,
                        CarpoolNeededLeg.FROM,
                        CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(false);
        when(rides.existsActivePassengerAssignment(
                        spaceId,
                        "UID:game-1",
                        CarpoolNeededLeg.FROM,
                        CarpoolFulfillmentStatus.ACTIVE,
                        pending.id()))
                .thenReturn(false);
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of());
        stubRequestingCircleEvent(pending);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));

        var accepted =
                service.accept(
                        adult,
                        spaceId,
                        pending.id(),
                        new AcceptCarpoolRequestRequest(vehicleId, null));

        assertThat(accepted).hasSize(1);
        assertThat(accepted.getFirst().leg()).isEqualTo(CarpoolNeededLeg.FROM);
        assertThat(accepted.getFirst().status()).isEqualTo(CarpoolFulfillmentStatus.ACTIVE);
        verify(rides, times(1)).save(any(CarpoolRideEntity.class));
    }

    @Test
    void passIdempotentOwnCircle409FullyCovered409() {
        CarpoolRequestEntity other =
                request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        stubMemberSpace();
        when(requests.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of());
        when(passes.existsByRequestIdAndAdultId(other.id(), adultId)).thenReturn(false);
        when(passes.save(any())).thenAnswer(inv -> inv.getArgument(0));
        CarpoolRequestPassEntity ownPass =
                new CarpoolRequestPassEntity(
                        UUID.randomUUID(),
                        other.id(),
                        adultId,
                        Instant.parse("2026-08-15T12:00:00Z"));
        when(passes.findByRequestIdIn(List.of(other.id()))).thenReturn(List.of(ownPass));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));

        var first = service.pass(adult, spaceId, other.id());
        assertThat(first.status()).isEqualTo(CarpoolRequestStatus.UNCOVERED);
        assertThat(first.passedByMe()).isTrue();
        assertThat(first.passedByAdultNames()).containsExactly("Alex");
        ArgumentCaptor<CarpoolRequestPassEntity> saved =
                ArgumentCaptor.forClass(CarpoolRequestPassEntity.class);
        verify(passes).save(saved.capture());
        assertThat(saved.getValue().requestId()).isEqualTo(other.id());
        assertThat(saved.getValue().adultId()).isEqualTo(adultId);

        when(passes.existsByRequestIdAndAdultId(other.id(), adultId)).thenReturn(true);
        var second = service.pass(adult, spaceId, other.id());
        assertThat(second.passedByMe()).isTrue();
        verify(passes).save(any());

        CarpoolRequestEntity own = request(circleId, adultId, kidA, bothLegs(), "1 Main St");
        when(requests.findByIdAndSpaceId(own.id(), spaceId)).thenReturn(Optional.of(own));
        assertThatThrownBy(() -> service.pass(adult, spaceId, own.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        CarpoolRideEntity to =
                activeRide(CarpoolNeededLeg.TO, otherAdultId, otherCircleId, Set.of(other.id()));
        CarpoolRideEntity from =
                activeRide(CarpoolNeededLeg.FROM, otherAdultId, otherCircleId, Set.of(other.id()));
        when(requests.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of(to, from));
        assertThatThrownBy(() -> service.pass(adult, spaceId, other.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createRideSameCircleHouseholdPassengerConflictAndVehicleAlreadyOnLeg() {
        CarpoolRequestEntity own = request(circleId, adultId, kidA, bothLegs(), "1 Main St");
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        when(requests.findByIdIn(List.of(own.id()))).thenReturn(List.of(own));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        spaceId, List.of("UID:game-1"), CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of());
        when(rides.existsActivePassengerAssignment(
                        spaceId,
                        "UID:game-1",
                        CarpoolNeededLeg.TO,
                        CarpoolFulfillmentStatus.ACTIVE,
                        own.id()))
                .thenReturn(false);
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                        spaceId,
                        "UID:game-1",
                        vehicleId,
                        CarpoolNeededLeg.TO,
                        CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(false);
        stubRsvps(List.of());
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.createRide(
                        adult,
                        spaceId,
                        new CreateCarpoolRideRequest(
                                "UID:game-1", CarpoolNeededLeg.TO, vehicleId, List.of(own.id())));

        assertThat(created.leg()).isEqualTo(CarpoolNeededLeg.TO);
        assertThat(created.status()).isEqualTo(CarpoolFulfillmentStatus.ACTIVE);
        assertThat(created.drivingCircleId()).isEqualTo(circleId);
        assertThat(created.passengerRequestIds()).containsExactly(own.id());
        verify(rsvpApi)
                .setStatus(
                        circleId,
                        RsvpItemSource.FEED,
                        eventId,
                        kidA,
                        RsvpStatus.YES,
                        adultId);

        when(rides.existsActivePassengerAssignment(
                        spaceId,
                        "UID:game-1",
                        CarpoolNeededLeg.TO,
                        CarpoolFulfillmentStatus.ACTIVE,
                        own.id()))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.createRide(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest(
                                                "UID:game-1",
                                                CarpoolNeededLeg.TO,
                                                vehicleId,
                                                List.of(own.id()))))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        when(rides.existsActivePassengerAssignment(
                        spaceId,
                        "UID:game-1",
                        CarpoolNeededLeg.TO,
                        CarpoolFulfillmentStatus.ACTIVE,
                        own.id()))
                .thenReturn(false);
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
                        spaceId,
                        "UID:game-1",
                        vehicleId,
                        CarpoolNeededLeg.TO,
                        CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.createRide(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest(
                                                "UID:game-1",
                                                CarpoolNeededLeg.TO,
                                                vehicleId,
                                                List.of(own.id()))))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void cancelByPassengerCircleAnd403WrongCircle() {
        CarpoolRequestEntity passenger =
                request(circleId, adultId, kidA, bothLegs(), "1 Main St");
        CarpoolRideEntity ride =
                activeRide(CarpoolNeededLeg.TO, otherAdultId, otherCircleId, Set.of(passenger.id()));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(ride.id(), spaceId)).thenReturn(Optional.of(ride));
        when(requests.findByIdIn(Set.of(passenger.id()))).thenReturn(List.of(passenger));
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(circleId, "House A"),
                                new FamilyCircleName(otherCircleId, "House B")));
        when(familyGarageApi.garageForCircle(otherCircleId))
                .thenReturn(garage(true, 7, List.of(otherAdultId)));
        when(familyMembershipApi.requireMemberCircleId(otherAdultId)).thenReturn(otherCircleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));

        var cancelled = service.cancel(adult, spaceId, ride.id());
        assertThat(cancelled.status()).isEqualTo(CarpoolFulfillmentStatus.CANCELLED);
        verify(rides).save(ride);

        CarpoolRequestEntity otherPassenger =
                request(otherCircleId, otherAdultId, kidB, bothLegs(), "2 Oak St");
        CarpoolRideEntity foreign =
                activeRide(CarpoolNeededLeg.TO, otherAdultId, otherCircleId, Set.of(otherPassenger.id()));
        when(rides.findByIdAndSpaceId(foreign.id(), spaceId)).thenReturn(Optional.of(foreign));
        when(requests.findByIdIn(Set.of(otherPassenger.id()))).thenReturn(List.of(otherPassenger));

        assertThatThrownBy(() -> service.cancel(adult, spaceId, foreign.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void withdrawByDrivingCircleAnd403WrongCircle() {
        CarpoolRequestEntity passenger =
                request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        CarpoolRideEntity ride =
                activeRide(CarpoolNeededLeg.TO, adultId, circleId, Set.of(passenger.id()));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(ride.id(), spaceId)).thenReturn(Optional.of(ride));
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));
        stubSpaceEvent(practiceEvent(List.of(kidA)));

        var withdrawn = service.withdraw(adult, spaceId, ride.id());
        assertThat(withdrawn.status()).isEqualTo(CarpoolFulfillmentStatus.WITHDRAWN);
        verify(leaveByApi).invalidateCalendarRoute(adultId, LeaveByItemSource.FEED, eventId);

        CarpoolRideEntity foreign =
                activeRide(CarpoolNeededLeg.TO, otherAdultId, otherCircleId, Set.of(passenger.id()));
        when(rides.findByIdAndSpaceId(foreign.id(), spaceId)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.withdraw(adult, spaceId, foreign.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void listMarksPassedByMeDetourOnOtherOnlyOwnDetourNull() {
        stubMemberSpace();
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-08-31T00:00:00Z");
        FeedCalendarEventDto event = practiceEvent(List.of(kidA));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(event));
        CarpoolRequestEntity own =
                request(circleId, adultId, kidA, bothLegs(), "12 Oak St, Cambridge, MA");
        CarpoolRequestEntity other =
                request(
                        otherCircleId,
                        otherAdultId,
                        kidB,
                        bothLegs(),
                        "12 Oak St, Cambridge, MA 02139");
        when(requests.findBySpaceIdAndEventKeyIn(eq(spaceId), any()))
                .thenReturn(List.of(own, other));
        when(rides.findBySpaceIdAndEventKeyInAndStatus(
                        eq(spaceId), any(), eq(CarpoolFulfillmentStatus.ACTIVE)))
                .thenReturn(List.of());
        when(passes.findByRequestIdIn(any()))
                .thenReturn(
                        List.of(
                                new CarpoolRequestPassEntity(
                                        UUID.randomUUID(), other.id(), adultId, Instant.now())));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(circleId, "House A"),
                                new FamilyCircleName(otherCircleId, "House B")));
        stubRsvps(List.of(yes(kidA)));
        when(leaveByApi.detourMinutesMany(
                        adultId,
                        List.of(
                                new DetourItemInput(
                                        "12 Oak St, Cambridge, MA 02139", "Field 3"))))
                .thenReturn(List.of(7));

        var listed = service.list(adult, spaceId, from, to);

        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().ownRequests()).hasSize(1);
        assertThat(listed.getFirst().ownRequests().getFirst().detourMinutes()).isNull();
        assertThat(listed.getFirst().ownRequests().getFirst().pickupTown())
                .isEqualTo("Cambridge, MA");
        assertThat(listed.getFirst().otherRequests()).hasSize(1);
        assertThat(listed.getFirst().otherRequests().getFirst().passedByMe()).isTrue();
        assertThat(listed.getFirst().otherRequests().getFirst().passedByAdultNames())
                .containsExactly("Alex");
        assertThat(listed.getFirst().otherRequests().getFirst().detourMinutes()).isEqualTo(7);
        assertThat(listed.getFirst().otherRequests().getFirst().pickupTown())
                .isEqualTo("Cambridge, MA");
        assertThat(listed.getFirst().otherRequests().getFirst().status())
                .isEqualTo(CarpoolRequestStatus.UNCOVERED);
    }

    @Test
    void withdrawAcceptedInboundForFeedEventWithdrawsActiveDrivingRides() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, eventId))
                .thenReturn(Optional.of(practiceEvent(List.of(kidA))));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId))
                .thenReturn(
                        List.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        CarpoolRequestEntity passenger =
                request(otherCircleId, otherAdultId, kidB, bothLegs(), "1 Main St");
        CarpoolRideEntity inbound =
                activeRide(CarpoolNeededLeg.TO, adultId, circleId, Set.of(passenger.id()));
        CarpoolRideEntity second =
                activeRide(CarpoolNeededLeg.FROM, adultId, circleId, Set.of(passenger.id()));
        when(rides.findBySpaceIdInAndEventKeyAndDrivingCircleIdAndStatus(
                        List.of(spaceId),
                        "UID:game-1",
                        circleId,
                        CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of(inbound, second));
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));
        stubSpaceEvent(practiceEvent(List.of(kidA)));

        service.withdrawAcceptedInboundForFeedEvent(adultId, eventId);

        assertThat(inbound.status()).isEqualTo(CarpoolFulfillmentStatus.WITHDRAWN);
        assertThat(second.status()).isEqualTo(CarpoolFulfillmentStatus.WITHDRAWN);
        verify(rides).save(inbound);
        verify(rides).save(second);
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void withdrawAcceptedInboundForFeedEventNoopsWhenEventMissingOrNoMemberships() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, eventId)).thenReturn(Optional.empty());

        service.withdrawAcceptedInboundForFeedEvent(adultId, eventId);

        verify(memberships, never()).findByCircleIdOrderByCreatedAtAsc(any());
        verify(rides, never()).save(any());

        when(feedCalendarApi.findEventInCircle(circleId, eventId))
                .thenReturn(Optional.of(practiceEvent(List.of(kidA))));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());

        service.withdrawAcceptedInboundForFeedEvent(adultId, eventId);

        verify(rides, never())
                .findBySpaceIdInAndEventKeyAndDrivingCircleIdAndStatus(
                        any(), any(), any(), any());
        verify(rides, never()).save(any());
    }

    @Test
    void listAcceptedPickupsForFeedEventReturnsDrivingOrRequestingPickups() {
        when(feedCalendarApi.findEventInCircle(circleId, eventId))
                .thenReturn(Optional.of(practiceEvent(List.of(kidA))));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId))
                .thenReturn(
                        List.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        CarpoolRequestEntity passenger =
                request(otherCircleId, otherAdultId, kidA, bothLegs(), "1 Main St");
        CarpoolRideEntity ride =
                activeRide(CarpoolNeededLeg.TO, adultId, circleId, Set.of(passenger.id()));
        when(rides.findBySpaceIdInAndEventKeyAndStatus(
                        List.of(spaceId), "UID:game-1", CarpoolFulfillmentStatus.ACTIVE))
                .thenReturn(List.of(ride));
        when(requests.findByIdIn(any())).thenReturn(List.of(passenger));

        var pickups = service.listAcceptedPickupsForFeedEvent(circleId, eventId);

        assertThat(pickups).hasSize(1);
        assertThat(pickups.getFirst().acceptedByAdultId()).isEqualTo(adultId);
        assertThat(pickups.getFirst().acceptingCircleId()).isEqualTo(circleId);
        assertThat(pickups.getFirst().requestingCircleId()).isEqualTo(otherCircleId);
        assertThat(pickups.getFirst().pickupAddress()).isEqualTo("1 Main St");
        assertThat(pickups.getFirst().kidIds()).containsExactly(kidA);
    }

    private void stubMemberSpace() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(
                        Optional.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
    }

    private void stubSpaceEvent(FeedCalendarEventDto event) {
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(
                        circleId,
                        CarpoolRideService.EVENT_LOOKUP_FROM,
                        CarpoolRideService.EVENT_LOOKUP_TO))
                .thenReturn(List.of(event));
    }

    private void stubRequestingCircleEvent(CarpoolRequestEntity request) {
        FeedResponse otherFeed =
                new FeedResponse(
                        feedId,
                        "Soccer",
                        "https://example.com/team.ics",
                        List.of(kidA, kidB),
                        Instant.parse("2026-08-01T00:00:00Z"),
                        null,
                        2);
        when(feedsApi.findByCircleAndNormalizedUrl(
                        request.requestingCircleId(), "https://example.com/team.ics"))
                .thenReturn(Optional.of(otherFeed));
        when(feedCalendarApi.listEventsInRange(
                        request.requestingCircleId(),
                        CarpoolRideService.EVENT_LOOKUP_FROM,
                        CarpoolRideService.EVENT_LOOKUP_TO))
                .thenReturn(
                        List.of(
                                new FeedCalendarEventDto(
                                        requestingEventId,
                                        feedId,
                                        "Soccer",
                                        "game-1",
                                        "Practice",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field 3",
                                        List.of(kidA, kidB))));
    }

    @SuppressWarnings("unchecked")
    private void stubRsvps(List<RsvpDto> rows) {
        when(rsvpApi.statusesForKids(eq(circleId), eq(RsvpItemSource.FEED), eq(eventId), any()))
                .thenReturn(rows);
    }

    private void stubPickup() {
        when(familyPlaceApi.findPickupPlaceForMember(adultId))
                .thenReturn(
                        Optional.of(
                                new CirclePlaceDto(
                                        UUID.randomUUID(),
                                        circleId,
                                        "Home",
                                        "1 Main St",
                                        null,
                                        null)));
    }

    @SuppressWarnings("unchecked")
    private void stubKidNames() {
        when(familyMembershipApi.findKids(eq(circleId), any()))
                .thenAnswer(
                        inv -> {
                            Collection<UUID> ids = inv.getArgument(1);
                            return ids.stream()
                                    .map(
                                            id ->
                                                    new FamilyKidName(
                                                            id, id.equals(kidB) ? "Riley" : "Sam"))
                                    .toList();
                        });
    }

    private GarageResponse garage(boolean drives, int seats, List<UUID> drivers) {
        return new GarageResponse(
                List.of(new GarageMemberDrivesResponse(adultId, "Alex", drives)),
                List.of(
                        new VehicleResponse(
                                vehicleId,
                                adultId,
                                drivers,
                                null,
                                "Van",
                                2020,
                                "HONDA",
                                "Odyssey",
                                seats,
                                8)));
    }

    private CarpoolRequestEntity request(
            UUID requestingCircle,
            UUID requester,
            UUID kidId,
            Set<CarpoolNeededLeg> legs,
            String pickupAddress) {
        return new CarpoolRequestEntity(
                UUID.randomUUID(),
                spaceId,
                "UID:game-1",
                kidId,
                kidId.equals(kidB) ? "Riley" : "Sam",
                requestingCircle,
                requester,
                "Home",
                pickupAddress,
                legs,
                Instant.now());
    }

    private CarpoolRideEntity activeRide(
            CarpoolNeededLeg leg,
            UUID driverAdultId,
            UUID drivingCircleId,
            Set<UUID> passengerRequestIds) {
        return new CarpoolRideEntity(
                UUID.randomUUID(),
                spaceId,
                "UID:game-1",
                leg,
                driverAdultId,
                drivingCircleId,
                vehicleId,
                passengerRequestIds,
                Instant.now());
    }

    private static Set<CarpoolNeededLeg> bothLegs() {
        return EnumSet.of(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
    }

    private FeedCalendarEventDto practiceEvent(List<UUID> kidIds) {
        return new FeedCalendarEventDto(
                eventId,
                feedId,
                "Soccer",
                "game-1",
                "Practice",
                Instant.parse("2026-08-15T17:00:00Z"),
                Instant.parse("2026-08-15T18:00:00Z"),
                "Field 3",
                kidIds);
    }

    private RsvpDto yes(UUID kidId) {
        return new RsvpDto(RsvpItemSource.FEED, eventId, kidId, RsvpStatus.YES);
    }

    private CarpoolSpaceEntity space() {
        return new CarpoolSpaceEntity(
                spaceId, "Soccer", "https://example.com/team.ics", "AB12CD34", Instant.now());
    }
}
