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
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolRidePlanLegAction;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import com.yourorg.quickapp.carpool.CarpoolSpaceMembership;
import com.yourorg.quickapp.carpool.CreateCarpoolRideRequest;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanLeg;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanRequest;
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
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
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
    private static final List<CarpoolRideStatus> ACTIVE =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED);

    @BeforeEach
    void setUp() {
        service =
                new CarpoolRideService(
                        adultSessionApi,
                        familyMembershipApi,
                        familyPlaceApi,
                        feedsApi,
                        feedCalendarApi,
                        rsvpApi,
                        leaveByApi,
                        spaces,
                        memberships,
                        rides,
                        passes);
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
                .thenReturn(
                        com.yourorg.quickapp.leaveby.CalendarRouteDto.unavailable(
                                "NO_ORIGIN", 0, List.of()));
        org.mockito.Mockito.lenient()
                .when(rides.findBySpaceIdInAndEventKeyAndAcceptedByAdultIdAndStatus(
                        any(), any(), any(), any()))
                .thenReturn(List.of());
        org.mockito.Mockito.lenient()
                .when(rides.findBySpaceIdInAndEventKeyAndStatus(any(), any(), any()))
                .thenReturn(List.of());
        org.mockito.Mockito.lenient()
                .when(
                        rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                                any(), any(), any(), any()))
                .thenReturn(List.of());
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
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.create(adult, spaceId, new CreateCarpoolRideRequest("UID:game-1", null, null));

        assertThat(created.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(created.kidIds()).containsExactly(kidA, kidB);
        assertThat(created.seats()).isEqualTo(2);
        assertThat(created.passedByAdultNames()).isEmpty();
        assertThat(created.pickupPlaceName()).isEqualTo("Home");
        assertThat(created.legs()).hasSize(2);
        assertThat(created.legs().get(0).kind()).isEqualTo(CarpoolLegKind.TO);
        assertThat(created.legs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        assertThat(created.legs().get(1).kind()).isEqualTo(CarpoolLegKind.FROM);
        assertThat(created.legs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
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
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.create(
                        adult, spaceId, new CreateCarpoolRideRequest("UID:game-1", List.of(kidA), null));

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
                                        new CreateCarpoolRideRequest("UID:game-1", null, null)))
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
                                        new CreateCarpoolRideRequest("UID:game-1", List.of(kidA), null)))
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
        when(familyPlaceApi.findPickupPlaceForMember(adultId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest("UID:game-1", null, null)))
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
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.PENDING))
                .thenReturn(List.of(pendingOwnRide(List.of(kidA))));

        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateCarpoolRideRequest("UID:game-1", null, null)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void acceptRecordsAdultCircleAndSetsRequestingKidsYes() {
        UUID requestingEventId = UUID.fromString("01900000-0000-7000-8000-000000000062");
        CarpoolRideRequestEntity pending = pendingOtherRide(List.of(kidA, kidB));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(pending.id(), spaceId)).thenReturn(Optional.of(pending));
        stubSpaceEvent(practiceEvent(List.of(kidA)));
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

        var accepted = service.accept(adult, spaceId, pending.id());

        assertThat(accepted.status()).isEqualTo(CarpoolRideStatus.ACCEPTED);
        assertThat(accepted.acceptedByAdultId()).isEqualTo(adultId);
        assertThat(accepted.acceptingCircleId()).isEqualTo(circleId);
        assertThat(accepted.passedByMe()).isFalse();
        assertThat(accepted.passedByAdultNames()).isEmpty();
        assertThat(accepted.legs())
                .extracting(leg -> leg.phase())
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(accepted.legs())
                .extracting(leg -> leg.assigneeAdultId())
                .containsOnly(adultId);
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
        verify(leaveByApi)
                .upsertCalendarRoute(
                        eq(adultId),
                        eq(LeaveByItemSource.FEED),
                        eq(eventId),
                        eq("Practice"),
                        eq(
                                List.of(
                                        new CalendarRoutePickupInput(
                                                "Home",
                                                "1 Main St",
                                                new CalendarRouteNotifyContact(
                                                        CalendarRouteNotifyChannel.PUSH, "Home")))),
                        eq("Field 3"),
                        eq("Field 3"));
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
        other.accept(otherAdultId, otherCircleId);
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
        verify(leaveByApi)
                .detourMinutesMany(
                        adultId,
                        List.of(new DetourItemInput("1 Main St", "Field 3")));
    }

    @Test
    void listEnrichesOtherRequestsWithPickupTownAndDetourMinutes() {
        stubMemberSpace();
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-08-31T00:00:00Z");
        FeedCalendarEventDto event = practiceEvent(List.of(kidA));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(event));
        CarpoolRideRequestEntity other =
                ride(otherCircleId, otherAdultId, List.of(kidA), "12 Oak St, Cambridge, MA 02139");
        when(rides.findBySpaceIdAndEventKeyInAndStatusIn(eq(spaceId), any(), any()))
                .thenReturn(List.of(other));
        when(passes.findByRideIdIn(any())).thenReturn(List.of());
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(otherCircleId, "House B")));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubRsvps(List.of(yes(kidA)));
        when(leaveByApi.detourMinutesMany(
                        adultId,
                        List.of(
                                new DetourItemInput(
                                        "12 Oak St, Cambridge, MA 02139", "Field 3"))))
                .thenReturn(List.of(7));

        var listed = service.list(adult, spaceId, from, to);

        assertThat(listed.getFirst().otherRequests()).hasSize(1);
        assertThat(listed.getFirst().otherRequests().getFirst().pickupTown()).isEqualTo("Cambridge, MA");
        assertThat(listed.getFirst().otherRequests().getFirst().detourMinutes()).isEqualTo(7);
    }

    @Test
    void listLeavesDetourMinutesNullOnOwnRequest() {
        stubMemberSpace();
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-08-31T00:00:00Z");
        FeedCalendarEventDto event = practiceEvent(List.of(kidA));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(event));
        CarpoolRideRequestEntity own =
                ride(circleId, adultId, List.of(kidA), "12 Oak St, Cambridge, MA");
        when(rides.findBySpaceIdAndEventKeyInAndStatusIn(eq(spaceId), any(), any()))
                .thenReturn(List.of(own));
        when(passes.findByRideIdIn(any())).thenReturn(List.of());
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubRsvps(List.of(yes(kidA)));

        var listed = service.list(adult, spaceId, from, to);

        assertThat(listed.getFirst().ownRequest().pickupTown()).isEqualTo("Cambridge, MA");
        assertThat(listed.getFirst().ownRequest().detourMinutes()).isNull();
        verify(leaveByApi, never()).detourMinutesMany(any(), any());
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
    void acceptOwnCircle409AndNotPending409() {
        CarpoolRideRequestEntity own = pendingOwnRide(List.of(kidA));
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(own.id(), spaceId)).thenReturn(Optional.of(own));

        assertThatThrownBy(() -> service.accept(adult, spaceId, own.id()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        CarpoolRideRequestEntity other = pendingOtherRide(List.of(kidA, kidB));
        other.accept(otherAdultId, otherCircleId);
        when(rides.findByIdAndSpaceId(other.id(), spaceId)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.accept(adult, spaceId, other.id()))
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
        assertThat(cancelled.passedByAdultNames()).isEmpty();
        verify(passes).deleteByRideId(pending.id());
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());

        CarpoolRideRequestEntity accepted = pendingOtherRide(List.of(kidA));
        accepted.accept(adultId, circleId);
        when(rides.findByIdAndSpaceId(accepted.id(), spaceId)).thenReturn(Optional.of(accepted));
        when(familyMembershipApi.findCircles(List.of(otherCircleId, circleId)))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(otherCircleId, "House B"),
                                new FamilyCircleName(circleId, "House A")));
        stubSpaceEvent(practiceEvent(List.of(kidA)));

        var withdrawn = service.withdraw(adult, spaceId, accepted.id());
        assertThat(withdrawn.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(withdrawn.acceptedByAdultId()).isNull();
        assertThat(withdrawn.legs())
                .extracting(leg -> leg.phase())
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        assertThat(withdrawn.passedByAdultNames()).isEmpty();
        verify(passes, never()).deleteByRideId(accepted.id());
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
        verify(leaveByApi)
                .invalidateCalendarRoute(adultId, LeaveByItemSource.FEED, eventId);
    }

    @Test
    void createRoundTripThenCancelOneLegLeavesOtherAsked() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.create(
                        adult, spaceId, new CreateCarpoolRideRequest("UID:game-1", null, null));
        assertThat(created.legs())
                .extracting(leg -> leg.phase())
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);

        ArgumentCaptor<CarpoolRideRequestEntity> saved =
                ArgumentCaptor.forClass(CarpoolRideRequestEntity.class);
        verify(rides).save(saved.capture());
        CarpoolRideRequestEntity entity = saved.getValue();
        when(rides.findByIdAndSpaceId(entity.id(), spaceId)).thenReturn(Optional.of(entity));

        var afterCancel =
                service.cancel(adult, spaceId, entity.id(), List.of(CarpoolLegKind.TO));
        assertThat(afterCancel.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(afterCancel.legs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(afterCancel.legs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
    }

    @Test
    void createSingleLegAskOnlyMarksThatLegAsked() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));

        var created =
                service.create(
                        adult,
                        spaceId,
                        new CreateCarpoolRideRequest(
                                "UID:game-1", null, List.of(CarpoolLegKind.TO)));
        assertThat(created.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(created.legs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        assertThat(created.legs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
    }

    @Test
    void acceptSingleLegAskConfirmsOnlyAskedLeg() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of());
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(
                        List.of(
                                new FamilyCircleName(circleId, "House A"),
                                new FamilyCircleName(otherCircleId, "House B")));

        var created =
                service.create(
                        adult,
                        spaceId,
                        new CreateCarpoolRideRequest(
                                "UID:game-1", null, List.of(CarpoolLegKind.TO)));
        ArgumentCaptor<CarpoolRideRequestEntity> saved =
                ArgumentCaptor.forClass(CarpoolRideRequestEntity.class);
        verify(rides).save(saved.capture());
        CarpoolRideRequestEntity pending = saved.getValue();

        AdultResponse accepter =
                new AdultResponse(otherAdultId, "b@example.com", "Sam");
        when(familyMembershipApi.requireMemberCircleId(otherAdultId)).thenReturn(otherCircleId);
        when(memberships.findBySpaceIdAndCircleId(spaceId, otherCircleId))
                .thenReturn(
                        Optional.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        otherCircleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        when(rides.findByIdAndSpaceId(pending.id(), spaceId)).thenReturn(Optional.of(pending));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(feedCalendarApi.listEventsInRange(
                        circleId, CarpoolRideService.EVENT_LOOKUP_FROM, CarpoolRideService.EVENT_LOOKUP_TO))
                .thenReturn(List.of(practiceEvent(List.of(kidA))));

        var accepted = service.accept(accepter, spaceId, pending.id());

        assertThat(accepted.status()).isEqualTo(CarpoolRideStatus.ACCEPTED);
        assertThat(accepted.legs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(accepted.legs().get(0).assigneeAdultId()).isEqualTo(otherAdultId);
        assertThat(accepted.legs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(accepted.legs().get(1).assigneeAdultId()).isNull();
    }

    @Test
    void cancelOmitConflictsWhenConfirmedAssigneesDifferThenPerLegSucceeds() {
        CarpoolRideRequestEntity ride = pendingOwnRide(List.of(kidA));
        ride.accept(adultId, circleId);
        ride.leg(CarpoolLegKind.FROM).setAssignee(otherAdultId, otherCircleId);
        stubMemberSpace();
        when(rides.findByIdAndSpaceId(ride.id(), spaceId)).thenReturn(Optional.of(ride));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(adultSessionApi.requireAdult(otherAdultId))
                .thenReturn(new AdultResponse(otherAdultId, "b@example.com", "Sam"));

        assertThatThrownBy(() -> service.cancel(adult, spaceId, ride.id(), null))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);

        var after =
                service.cancel(adult, spaceId, ride.id(), List.of(CarpoolLegKind.TO));
        assertThat(after.status()).isEqualTo(CarpoolRideStatus.ACCEPTED);
        assertThat(after.legs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(after.legs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(after.legs().get(1).assigneeAdultId()).isEqualTo(otherAdultId);
        assertThat(after.acceptedByAdultId()).isEqualTo(otherAdultId);
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

    @Test
    void withdrawAcceptedInboundForFeedEventWithdrawsMatchingAcceptedRides() {
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
        CarpoolRideRequestEntity inbound = pendingOtherRide(List.of(kidB));
        inbound.accept(adultId, circleId);
        CarpoolRideRequestEntity second = pendingOtherRide(List.of(kidA));
        second.accept(adultId, circleId);
        when(rides.findBySpaceIdInAndEventKeyAndAcceptingCircleIdAndStatus(
                        List.of(spaceId),
                        "UID:game-1",
                        circleId,
                        CarpoolRideStatus.ACCEPTED))
                .thenReturn(List.of(inbound, second));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.withdrawAcceptedInboundForFeedEvent(adultId, eventId);

        assertThat(inbound.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(inbound.acceptingCircleId()).isNull();
        assertThat(second.status()).isEqualTo(CarpoolRideStatus.PENDING);
        verify(rides).save(inbound);
        verify(rides).save(second);
        verify(rsvpApi, never()).setStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    void withdrawAcceptedInboundForFeedEventNoopsWhenEventMissing() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, eventId)).thenReturn(Optional.empty());

        service.withdrawAcceptedInboundForFeedEvent(adultId, eventId);

        verify(memberships, never()).findByCircleIdOrderByCreatedAtAsc(any());
        verify(rides, never()).save(any());
    }

    @Test
    void withdrawAcceptedInboundForFeedEventNoopsWhenNoSpaceMemberships() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, eventId))
                .thenReturn(Optional.of(practiceEvent(List.of(kidA))));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());

        service.withdrawAcceptedInboundForFeedEvent(adultId, eventId);

        verify(rides, never())
                .findBySpaceIdInAndEventKeyAndAcceptingCircleIdAndStatus(
                        any(), any(), any(), any());
        verify(rides, never()).save(any());
    }

    @Test
    void clearTransportForNotGoingKidRemovesKidKeepingSharedPendingPlan() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, eventId))
                .thenReturn(Optional.of(practiceEvent(List.of(kidA, kidB))));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId))
                .thenReturn(
                        List.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        CarpoolRideRequestEntity pending = pendingOwnRide(List.of(kidA, kidB));
        when(rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(List.of(spaceId)), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(List.of(pending));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.clearTransportForNotGoingKid(adultId, eventId, kidA);

        assertThat(pending.status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(pending.kids()).extracting(RideKidSnapshot::kidId).containsExactly(kidB);
        assertThat(pending.legs())
                .extracting(RideLegSlot::phase)
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        verify(rides).save(pending);
        verify(passes, never()).deleteByRideId(any());
    }

    @Test
    void clearTransportForNotGoingKidCancelsPendingWhenLastKidRemoved() {
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
        CarpoolRideRequestEntity pending = pendingOwnRide(List.of(kidA));
        when(rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(List.of(spaceId)), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(List.of(pending));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.clearTransportForNotGoingKid(adultId, eventId, kidA);

        assertThat(pending.status()).isEqualTo(CarpoolRideStatus.CANCELLED);
        assertThat(pending.kids()).isEmpty();
        assertThat(pending.legs())
                .extracting(RideLegSlot::phase)
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        verify(passes).deleteByRideId(pending.id());
    }

    @Test
    void clearTransportForNotGoingKidCancelsAcceptedWhenLastKidRemoved() {
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
        CarpoolRideRequestEntity accepted = pendingOwnRide(List.of(kidA));
        accepted.accept(otherAdultId, otherCircleId);
        when(rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(List.of(spaceId)), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(List.of(accepted));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));
        when(familyMembershipApi.requireMemberCircleId(otherAdultId)).thenReturn(otherCircleId);
        when(feedsApi.findByCircleAndNormalizedUrl(otherCircleId, "https://example.com/team.ics"))
                .thenReturn(Optional.empty());

        service.clearTransportForNotGoingKid(adultId, eventId, kidA);

        assertThat(accepted.status()).isEqualTo(CarpoolRideStatus.CANCELLED);
        assertThat(accepted.acceptedByAdultId()).isNull();
        assertThat(accepted.legs())
                .extracting(RideLegSlot::phase)
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        verify(passes).deleteByRideId(accepted.id());
    }

    @Test
    void clearTransportForNotGoingKidCancelsMixedWaitingHouseholdWhenLastKidRemoved() {
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
        CarpoolRideRequestEntity mixed = pendingOwnRide(List.of(kidA));
        mixed.replaceLegs(
                List.of(
                        RideLegSlot.waitingHousehold(CarpoolLegKind.TO, otherAdultId),
                        RideLegSlot.askedTeam(CarpoolLegKind.FROM)));
        when(rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                        eq(List.of(spaceId)), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(List.of(mixed));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.clearTransportForNotGoingKid(adultId, eventId, kidA);

        assertThat(mixed.status()).isEqualTo(CarpoolRideStatus.CANCELLED);
        assertThat(mixed.kids()).isEmpty();
        assertThat(mixed.legs())
                .extracting(RideLegSlot::phase)
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(mixed.legs())
                .allSatisfy(leg -> assertThat(leg.assigneeAdultId()).isNull());
        verify(passes).deleteByRideId(mixed.id());
    }

    @Test
    void confirmHouseholdPlanConfirmsWaitingLegKeepingAsk() {
        CarpoolRideRequestEntity mixed = pendingOwnRide(List.of(kidA));
        mixed.replaceLegs(
                List.of(
                        RideLegSlot.waitingHousehold(CarpoolLegKind.TO, otherAdultId),
                        RideLegSlot.askedTeam(CarpoolLegKind.FROM)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.PENDING))
                .thenReturn(List.of(mixed));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(adultSessionApi.requireAdult(otherAdultId))
                .thenReturn(new AdultResponse(otherAdultId, "other@example.com", "Katy"));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "Ours")));

        AdultResponse katy =
                new AdultResponse(otherAdultId, "other@example.com", "Katy");
        when(familyMembershipApi.requireMemberCircleId(otherAdultId)).thenReturn(circleId);
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(
                        Optional.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));

        var result = service.confirmHouseholdPlan(katy, spaceId, "UID:game-1");

        assertThat(result.ownLegs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(result.ownLegs().get(0).assigneeAdultId()).isEqualTo(otherAdultId);
        assertThat(result.ownLegs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        assertThat(result.ownRequest()).isNotNull();
        assertThat(result.ownRequest().status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(mixed.pickupAddress()).isEqualTo("1 Main St");
        assertThat(mixed.requestedByAdultId()).isEqualTo(adultId);
    }

    @Test
    void declineHouseholdPlanClearsWaitingLegKeepingAsk() {
        CarpoolRideRequestEntity mixed = pendingOwnRide(List.of(kidA));
        mixed.replaceLegs(
                List.of(
                        RideLegSlot.waitingHousehold(CarpoolLegKind.TO, otherAdultId),
                        RideLegSlot.askedTeam(CarpoolLegKind.FROM)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.PENDING))
                .thenReturn(List.of(mixed));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "Ours")));

        AdultResponse katy =
                new AdultResponse(otherAdultId, "other@example.com", "Katy");
        when(familyMembershipApi.requireMemberCircleId(otherAdultId)).thenReturn(circleId);
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(
                        Optional.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space()));

        var result = service.declineHouseholdPlan(katy, spaceId, "UID:game-1");

        assertThat(result.ownLegs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(result.ownLegs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        assertThat(result.ownRequest()).isNotNull();
        assertThat(mixed.pickupAddress()).isEqualTo("1 Main St");
    }

    @Test
    void savePlanHouseholdSelfAndAskTeamPersistsMixedLegs() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        eq(spaceId), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(List.of());
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);

        var saved =
                service.savePlan(
                        adult,
                        spaceId,
                        new SaveCarpoolRidePlanRequest(
                                "UID:game-1",
                                null,
                                List.of(
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.TO,
                                                CarpoolRidePlanLegAction.HOUSEHOLD,
                                                adultId),
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.FROM,
                                                CarpoolRidePlanLegAction.ASK_TEAM,
                                                null))));

        assertThat(saved.ownRequest()).isNotNull();
        assertThat(saved.ownRequest().status()).isEqualTo(CarpoolRideStatus.PENDING);
        assertThat(saved.ownLegs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(saved.ownLegs().get(0).assigneeAdultId()).isEqualTo(adultId);
        assertThat(saved.ownLegs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM);
        ArgumentCaptor<CarpoolRideRequestEntity> captor =
                ArgumentCaptor.forClass(CarpoolRideRequestEntity.class);
        verify(rides).save(captor.capture());
        assertThat(captor.getValue().status()).isEqualTo(CarpoolRideStatus.PENDING);
    }

    @Test
    void savePlanHouseholdOtherAdultIsWaitingHouseholdPlan() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        eq(spaceId), eq("UID:game-1"), eq(circleId), any()))
                .thenReturn(List.of());
        when(familyPlaceApi.findPickupPlaceForMember(adultId)).thenReturn(Optional.empty());
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(adultSessionApi.requireAdult(otherAdultId))
                .thenReturn(new AdultResponse(otherAdultId, "b@example.com", "Blake"));

        var saved =
                service.savePlan(
                        adult,
                        spaceId,
                        new SaveCarpoolRidePlanRequest(
                                "UID:game-1",
                                null,
                                List.of(
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.TO,
                                                CarpoolRidePlanLegAction.HOUSEHOLD,
                                                otherAdultId),
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.FROM,
                                                CarpoolRidePlanLegAction.NEEDS_RIDE,
                                                null))));

        assertThat(saved.ownRequest()).isNull();
        assertThat(saved.ownLegs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.WAITING_HOUSEHOLD);
        assertThat(saved.ownLegs().get(0).assigneeAdultId()).isEqualTo(otherAdultId);
        assertThat(saved.ownLegs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        ArgumentCaptor<CarpoolRideRequestEntity> captor =
                ArgumentCaptor.forClass(CarpoolRideRequestEntity.class);
        verify(rides).save(captor.capture());
        assertThat(captor.getValue().status()).isEqualTo(CarpoolRideStatus.PLAN);
    }

    @Test
    void savePlanAskThenNeedsRideClearsTeamAsk() {
        stubMemberSpace();
        stubSpaceEvent(practiceEvent(List.of(kidA)));
        stubRsvps(List.of(yes(kidA)));
        CarpoolRideRequestEntity pending = pendingOwnRide(List.of(kidA));
        when(rides.findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
                        spaceId, "UID:game-1", circleId, CarpoolRideStatus.PENDING))
                .thenReturn(List.of(pending));
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var saved =
                service.savePlan(
                        adult,
                        spaceId,
                        new SaveCarpoolRidePlanRequest(
                                "UID:game-1",
                                null,
                                List.of(
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.TO,
                                                CarpoolRidePlanLegAction.NEEDS_RIDE,
                                                null),
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.FROM,
                                                CarpoolRidePlanLegAction.NEEDS_RIDE,
                                                null))));

        assertThat(saved.ownRequest()).isNull();
        assertThat(saved.ownLegs())
                .extracting(leg -> leg.phase())
                .containsExactly(
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE,
                        com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(pending.status()).isEqualTo(CarpoolRideStatus.CANCELLED);
        verify(passes).deleteByRideId(pending.id());
    }

    @Test
    void saveCirclePlanHouseholdSelfPersistsNullSpacePlan() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(rides.findByRequestingCircleIdAndEventKeyAndSpaceIdIsNullAndStatusIn(
                        eq(circleId), eq("CAL:MANUAL:e1"), any()))
                .thenReturn(List.of());
        stubPickup();
        stubKidNames();
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);

        var saved =
                service.saveCirclePlan(
                        adult,
                        new SaveCarpoolRidePlanRequest(
                                "CAL:MANUAL:e1",
                                List.of(kidA),
                                List.of(
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.TO,
                                                CarpoolRidePlanLegAction.HOUSEHOLD,
                                                adultId),
                                        new SaveCarpoolRidePlanLeg(
                                                CarpoolLegKind.FROM,
                                                CarpoolRidePlanLegAction.HOUSEHOLD,
                                                adultId))));

        assertThat(saved.ownRequest()).isNull();
        assertThat(saved.ownLegs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(saved.ownLegs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        ArgumentCaptor<CarpoolRideRequestEntity> captor =
                ArgumentCaptor.forClass(CarpoolRideRequestEntity.class);
        verify(rides).save(captor.capture());
        assertThat(captor.getValue().spaceId()).isNull();
        assertThat(captor.getValue().status()).isEqualTo(CarpoolRideStatus.PLAN);
    }

    @Test
    void clearCirclePlanLegsClearsOneHouseholdLegWithoutResettingTheOther() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        CarpoolRideRequestEntity plan =
                new CarpoolRideRequestEntity(
                        UUID.randomUUID(),
                        null,
                        "CAL:MANUAL:e1",
                        circleId,
                        adultId,
                        "Home",
                        "1 Main",
                        List.of(new RideKidSnapshot(kidA, "Maya")),
                        EnumSet.noneOf(CarpoolLegKind.class),
                        Instant.parse("2030-01-01T00:00:00Z"));
        plan.replaceLegs(
                List.of(
                        RideLegSlot.householdConfirmed(CarpoolLegKind.TO, adultId),
                        RideLegSlot.householdConfirmed(CarpoolLegKind.FROM, otherAdultId)));
        when(rides.findByRequestingCircleIdAndEventKeyAndSpaceIdIsNullAndStatusIn(
                        eq(circleId), eq("CAL:MANUAL:e1"), any()))
                .thenReturn(List.of(plan));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House A")));
        when(adultSessionApi.requireAdult(otherAdultId))
                .thenReturn(new AdultResponse(otherAdultId, "katy@example.com", "Katy"));

        var cleared =
                service.clearCirclePlanLegs(adult, "CAL:MANUAL:e1", List.of(CarpoolLegKind.TO));

        assertThat(cleared.ownLegs().get(0).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.NEEDS_RIDE);
        assertThat(cleared.ownLegs().get(1).phase())
                .isEqualTo(com.yourorg.quickapp.carpool.CarpoolLegPhase.CONFIRMED);
        assertThat(cleared.ownLegs().get(1).assigneeAdultId()).isEqualTo(otherAdultId);
        assertThat(plan.status()).isEqualTo(CarpoolRideStatus.PLAN);
    }

    @Test
    void saveCirclePlanRejectsAskTeam() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);

        assertThatThrownBy(
                        () ->
                                service.saveCirclePlan(
                                        adult,
                                        new SaveCarpoolRidePlanRequest(
                                                "CAL:MANUAL:e1",
                                                List.of(kidA),
                                                List.of(
                                                        new SaveCarpoolRidePlanLeg(
                                                                CarpoolLegKind.TO,
                                                                CarpoolRidePlanLegAction.ASK_TEAM,
                                                                null),
                                                        new SaveCarpoolRidePlanLeg(
                                                                CarpoolLegKind.FROM,
                                                                CarpoolRidePlanLegAction.NEEDS_RIDE,
                                                                null)))))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(rides, never()).save(any());
    }

    @Test
    void attachCircleLocalPlansToSpaceAttachesMatchingFeedKeys() {
        CarpoolRideRequestEntity local =
                new CarpoolRideRequestEntity(
                        UUID.randomUUID(),
                        null,
                        "UID:game-1",
                        circleId,
                        adultId,
                        "Home",
                        "1 Main St",
                        List.of(new RideKidSnapshot(kidA, "Sam")),
                        EnumSet.noneOf(CarpoolLegKind.class),
                        Instant.now());
        when(feedCalendarApi.listEventsInRange(
                        circleId, CarpoolRideService.EVENT_LOOKUP_FROM, CarpoolRideService.EVENT_LOOKUP_TO))
                .thenReturn(List.of(practiceEvent(List.of(kidA))));
        when(rides.findByRequestingCircleIdAndEventKeyInAndSpaceIdIsNullAndStatusIn(
                        eq(circleId), any(), any()))
                .thenReturn(List.of(local));
        when(rides.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.attachCircleLocalPlansToSpace(circleId, spaceId, feedId);

        assertThat(local.spaceId()).isEqualTo(spaceId);
        verify(rides).save(local);
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

    private CarpoolRideRequestEntity pendingOtherRide(List<UUID> kidIds) {
        return ride(otherCircleId, otherAdultId, kidIds, "1 Main St");
    }

    private CarpoolRideRequestEntity pendingOwnRide(List<UUID> kidIds) {
        return ride(circleId, adultId, kidIds, "1 Main St");
    }

    private CarpoolRideRequestEntity ride(UUID requestingCircle, UUID requester, List<UUID> kidIds) {
        return ride(requestingCircle, requester, kidIds, "1 Main St");
    }

    private CarpoolRideRequestEntity ride(
            UUID requestingCircle, UUID requester, List<UUID> kidIds, String pickupAddress) {
        List<RideKidSnapshot> kids =
                kidIds.stream().map(id -> new RideKidSnapshot(id, "Kid")).toList();
        return new CarpoolRideRequestEntity(
                UUID.randomUUID(),
                spaceId,
                "UID:game-1",
                requestingCircle,
                requester,
                "Home",
                pickupAddress,
                kids,
                EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM),
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
