package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.AcceptCarpoolRideRequest;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import com.yourorg.quickapp.carpool.CarpoolSpaceMembership;
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
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
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
    private CarpoolSpaceRepository spaces;

    @Mock
    private CarpoolMembershipRepository memberships;

    @Mock
    private CarpoolRideRequestRepository rides;

    @Mock
    private CarpoolRidePassRepository passes;

    private CarpoolRideService service;

    private final UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000001");
    private final UUID otherAdultId = UUID.fromString("01900000-0000-7000-8000-000000000002");
    private final UUID circleId = UUID.fromString("01900000-0000-7000-8000-000000000010");
    private final UUID otherCircleId = UUID.fromString("01900000-0000-7000-8000-000000000011");
    private final UUID feedId = UUID.fromString("01900000-0000-7000-8000-000000000041");
    private final UUID spaceId = UUID.fromString("01900000-0000-7000-8000-000000000080");
    private final UUID eventId = UUID.fromString("01900000-0000-7000-8000-000000000061");
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

    @BeforeEach
    void setUp() {
        service =
                new CarpoolRideService(
                        adultSessionApi,
                        familyMembershipApi,
                        familyPlaceApi,
                        familyGarageApi,
                        feedsApi,
                        feedCalendarApi,
                        rsvpApi,
                        spaces,
                        memberships,
                        rides,
                        passes);
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
    void createDefaultsToYesAndNoResponseKidsWhoStillNeedARide() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(
                List.of(
                        yes(kidA),
                        new RsvpDto(RsvpItemSource.FEED, eventId, kidB, RsvpStatus.NO_RESPONSE)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        when(rides.existsBySpaceIdAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(spaceId), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(false);
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.create(adult, spaceId, new CreateCarpoolRideRequest("UID:game-1", null));

        assertThat(created.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(created.kidIds()).containsExactly(kidA, kidB);
        assertThat(created.seats()).isEqualTo(2);
        assertThat(created.passedByAdultNames()).isEmpty();
        assertThat(created.pickupPlaceName()).isEqualTo("Home");
        ArgumentCaptor<CarpoolRideRequestEntity> saved =
                ArgumentCaptor.forClass(CarpoolRideRequestEntity.class);
        verify(rides).save(saved.capture());
        assertThat(saved.getValue().eventKey()).isEqualTo("UID:game-1");
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void createOverrideMustBeSubsetOfDefault() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(
                List.of(
                        new RsvpDto(RsvpItemSource.FEED, eventId, kidA, RsvpStatus.NO_RESPONSE),
                        yes(kidB)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        when(rides.existsBySpaceIdAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(spaceId), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(false);
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.create(
                        adult, spaceId, new CreateCarpoolRideRequest("UID:game-1", List.of(kidA)));

        assertThat(created.kidIds()).containsExactly(kidA);
        assertThat(created.seats()).isEqualTo(1);
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void create400WhenDefaultEmptyOrKidIsRsvpNo() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(
                List.of(
                        new RsvpDto(RsvpItemSource.FEED, eventId, kidA, RsvpStatus.NO),
                        new RsvpDto(RsvpItemSource.FEED, eventId, kidB, RsvpStatus.NO)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());

        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest("UID:game-1", null)))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex -> {
                            assertThat(((CarpoolException) ex).status())
                                    .isEqualTo(HttpStatus.BAD_REQUEST);
                            assertThat(ex.getMessage()).doesNotContain("RSVP Yes first");
                        });
        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest("UID:game-1", List.of(kidA))))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(rides, never()).save(any());
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void create400WhenNoPickupAddress() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        when(rides.existsBySpaceIdAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(spaceId), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(false);
        when(familyPlaceApi.findPickupPlaceForMember(adultId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest("UID:game-1", null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void create409WhenActiveDuplicate() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        when(rides.existsBySpaceIdAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(spaceId), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest("UID:game-1", null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void acceptSeatMathRecordsVehicleAndSetsRequestingKidsYes() {
        UUID requestingEventId = UUID.fromString("01900000-0000-7000-8000-000000000062");
        CarpoolRideRequestEntity pending = pendingOtherRide(List.of(kidA, kidB));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(pending.id(), spaceId)).thenReturn(Optional.of(pending));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndStatus(
                        spaceId, "UID:game-1", vehicleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(false);
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        FeedResponse otherFeed =
                new FeedResponse(
                        feedId,
                        "Soccer",
                        "https://example.com/team.ics",
                        List.of(kidA, kidB),
                        Instant.parse("2026-08-01T00:00:00Z"),
                        null,
                        2);
        when(feedsApi.findByCircleAndNormalizedUrl(otherCircleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(otherFeed));
        when(feedCalendarApi.listEventsInRange(
                        otherCircleId,
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
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(otherCircleId, circleId)))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));

        var accepted =
                service.accept(
                        adult, spaceId, pending.id(), new AcceptCarpoolRideRequest(vehicleId));

        assertThat(accepted.status()).isEqualTo(CarpoolRideStatus.ACCEPTED);
        assertThat(accepted.acceptedByAdultId()).isEqualTo(adultId);
        assertThat(accepted.acceptingCircleId()).isEqualTo(circleId);
        assertThat(accepted.vehicleId()).isEqualTo(vehicleId);
        assertThat(accepted.vehicleLabel()).isEqualTo("Van");
        assertThat(accepted.passedByMe()).isFalse();
        assertThat(accepted.passedByAdultNames()).isEmpty();
        verify(passes).deleteByRideId(pending.id());
        verify(rsvpApi)
                .setStatus(
                        otherCircleId,
                        RsvpItemSource.FEED,
                        requestingEventId,
                        kidA,
                        RsvpStatus.YES,
                        adultId);
        verify(rsvpApi)
                .setStatus(
                        otherCircleId,
                        RsvpItemSource.FEED,
                        requestingEventId,
                        kidB,
                        RsvpStatus.YES,
                        adultId);
    }

    @Test
    void passRecordsIdempotentAndDoesNotRequireDrives() {
        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));
        when(passes.existsByRideIdAndAdultId(other.id(), adultId)).thenReturn(false);
        when(passes.save(any())).thenAnswer(inv -> inv.getArgument(0));
        CarpoolRidePassEntity ownPass =
                new CarpoolRidePassEntity(
                        UUID.randomUUID(),
                        other.id(),
                        adultId,
                        Instant.parse("2026-08-15T12:00:00Z"));
        when(passes.findByRideIdIn(List.of(other.id()))).thenReturn(List.of(ownPass));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);
        when(familyMembershipApi.findCircles(List.of(otherCircleId, circleId)))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));

        var first = service.pass(adult, spaceId, other.id());
        assertThat(first.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(first.passedByMe()).isTrue();
        assertThat(first.passedByAdultNames()).containsExactly("Alex");
        ArgumentCaptor<CarpoolRidePassEntity> saved =
                ArgumentCaptor.forClass(CarpoolRidePassEntity.class);
        verify(passes).save(saved.capture());
        assertThat(saved.getValue().rideId()).isEqualTo(other.id());
        assertThat(saved.getValue().adultId()).isEqualTo(adultId);

        when(passes.existsByRideIdAndAdultId(other.id(), adultId)).thenReturn(true);
        var second = service.pass(adult, spaceId, other.id());
        assertThat(second.passedByMe()).isTrue();
        assertThat(second.passedByAdultNames()).containsExactly("Alex");
        verify(passes).save(any());
    }

    @Test
    void passOwnCircle409NotPending409() {
        CarpoolRideRequestEntity own = pendingOwnRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(own.id(), spaceId)).thenReturn(Optional.of(own));

        assertThatThrownBy(() -> service.pass(adult, spaceId, own.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA));
        other.accept(otherAdultId, otherCircleId, vehicleId);
        when(rides.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.pass(adult, spaceId, other.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(passes, never()).save(any());
    }

    @Test
    void listMarksPassedByMeOnOtherRequestsOnly() {
        stubMemberSpace();
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-08-31T00:00:00Z");
        FeedCalendarEventDto event = practiceEvent(List.of(kidA));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(event));
        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA));
        when(rides.findBySpaceIdAndEventKeyInAndStatusIn(eq(spaceId), any(), any()))
                .thenReturn(List.of(other));
        when(passes.findByRideIdIn(any()))
                .thenReturn(
                        List.of(
                                new CarpoolRidePassEntity(
                                        UUID.randomUUID(), other.id(), adultId, Instant.now())));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(otherCircleId, "House B")));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubRsvps(List.of(yes(kidA)));

        var listed = service.list(adult, spaceId, from, to);

        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().otherRequests()).hasSize(1);
        assertThat(listed.getFirst().otherRequests().getFirst().passedByMe()).isTrue();
        assertThat(listed.getFirst().otherRequests().getFirst().passedByAdultNames())
                .containsExactly("Alex");
        assertThat(listed.getFirst().otherRequests().getFirst().status())
                .isEqualTo(CarpoolRideStatus.PENDING);
    }

    @Test
    void listOrdersPassedByAdultNamesByPassCreatedAt() {
        stubMemberSpace();
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-08-31T00:00:00Z");
        FeedCalendarEventDto event = practiceEvent(List.of(kidA));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(event));
        CarpoolRideRequestEntity own = pendingOwnRide(List.of(kidA));
        when(rides.findBySpaceIdAndEventKeyInAndStatusIn(eq(spaceId), any(), any()))
                .thenReturn(List.of(own));
        UUID passerEarly = UUID.fromString("01900000-0000-7000-8000-0000000000a1");
        UUID passerLate = UUID.fromString("01900000-0000-7000-8000-0000000000a2");
        when(passes.findByRideIdIn(any()))
                .thenReturn(
                        List.of(
                                new CarpoolRidePassEntity(
                                        UUID.randomUUID(),
                                        own.id(),
                                        passerLate,
                                        Instant.parse("2026-08-15T13:00:00Z")),
                                new CarpoolRidePassEntity(
                                        UUID.randomUUID(),
                                        own.id(),
                                        passerEarly,
                                        Instant.parse("2026-08-15T12:00:00Z"))));
        when(adultSessionApi.requireAdult(passerEarly))
                .thenReturn(new AdultResponse(passerEarly, "early@example.com", "Early"));
        when(adultSessionApi.requireAdult(passerLate))
                .thenReturn(new AdultResponse(passerLate, "late@example.com", "Late"));
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubRsvps(List.of(yes(kidA)));

        var listed = service.list(adult, spaceId, from, to);

        assertThat(listed.getFirst().ownRequest().passedByMe()).isFalse();
        assertThat(listed.getFirst().ownRequest().passedByAdultNames())
                .containsExactly("Early", "Late");
        verify(passes).findByRideIdIn(any());
        verify(passes, never()).findByRideIdInAndAdultId(any(), any());
    }

    @Test
    void acceptOwnCircle409DrivesFalse403NotEnoughSeats409() {
        CarpoolRideRequestEntity own = pendingOwnRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(own.id(), spaceId)).thenReturn(Optional.of(own));

        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult, spaceId, own.id(), new AcceptCarpoolRideRequest(vehicleId)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA, kidB));
        when(rides.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(false, 7, List.of(adultId)));

        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new AcceptCarpoolRideRequest(vehicleId)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);

        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 4, List.of(adultId)));
        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndStatus(
                        spaceId, "UID:game-1", vehicleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(false);
        stubSpaceEvent(practiceEvent(List.of(kidA, kidB)));
        stubRsvps(List.of(yes(kidA), yes(kidB)));

        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new AcceptCarpoolRideRequest(vehicleId)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void acceptUnknownVehicle404AndAlreadyCommitted409() {
        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));
        when(familyGarageApi.garageForCircle(circleId)).thenReturn(garage(true, 7, List.of(adultId)));

        UUID unknown = UUID.fromString("01900000-0000-7000-8000-000000000099");
        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult, spaceId, other.id(), new AcceptCarpoolRideRequest(unknown)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);

        when(rides.existsBySpaceIdAndEventKeyAndVehicleIdAndStatus(
                        spaceId, "UID:game-1", vehicleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.accept(
                                        adult,
                                        spaceId,
                                        other.id(),
                                        new AcceptCarpoolRideRequest(vehicleId)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void cancelAndWithdraw() {
        CarpoolRideRequestEntity pending = pendingOwnRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(pending.id(), spaceId)).thenReturn(Optional.of(pending));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var cancelled = service.cancel(adult, spaceId, pending.id());
        assertThat(cancelled.status()).isEqualTo(CarpoolRideStatus.CANCELLED);
        verify(passes).deleteByRideId(pending.id());
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());

        CarpoolRideRequestEntity accepted = pendingOtherRide(List.of(kidA));
        accepted.accept(adultId, circleId, vehicleId);
        when(rides.findByIdAndSpaceId(accepted.id(), spaceId)).thenReturn(Optional.of(accepted));
        when(familyMembershipApi.findCircles(List.of(otherCircleId, circleId)))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));

        var withdrawn = service.withdraw(adult, spaceId, accepted.id());
        assertThat(withdrawn.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(withdrawn.vehicleId()).isNull();
        assertThat(withdrawn.acceptedByAdultId()).isNull();
        verify(passes, never()).deleteByRideId(accepted.id());
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void cancelWrongCircle403WithdrawWrongCircle403() {
        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.cancel(adult, spaceId, other.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThatThrownBy(() -> service.withdraw(adult, spaceId, other.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
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
                        circleId, CarpoolRideService.EVENT_LOOKUP_FROM, CarpoolRideService.EVENT_LOOKUP_TO))
                .thenReturn(List.of(event));
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

    private CarpoolRideRequestEntity pendingOtherRide(List<UUID> kidIds) {
        return ride(otherCircleId, otherAdultId, kidIds);
    }

    private CarpoolRideRequestEntity pendingOwnRide(List<UUID> kidIds) {
        return ride(circleId, adultId, kidIds);
    }

    private CarpoolRideRequestEntity ride(UUID requestingCircle, UUID requester, List<UUID> kidIds) {
        List<RideKidSnapshot> kids =
                kidIds.stream().map(id -> new RideKidSnapshot(id, "Kid")).toList();
        return new CarpoolRideRequestEntity(
                UUID.randomUUID(),
                spaceId,
                "UID:game-1",
                requestingCircle,
                requester,
                "Home",
                "1 Main St",
                kids,
                Instant.now());
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
