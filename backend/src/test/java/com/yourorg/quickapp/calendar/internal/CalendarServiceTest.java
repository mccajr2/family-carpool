package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.AssignCalendarCoverageRequest;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.CalendarLeaveByResponse;
import com.yourorg.quickapp.calendar.CalendarRouteResponse;
import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.carpool.CarpoolHouseholdStopDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.leaveby.CalendarRouteDto;
import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.CalendarRouteMemberRef;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import com.yourorg.quickapp.leaveby.CalendarRouteStopDto;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
import com.yourorg.quickapp.leaveby.LeaveFromPlaceDto;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class CalendarServiceTest {

    @Mock
    private FamilyMembershipApi familyMembershipApi;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private ManualEventCalendarApi manualEventCalendarApi;

    @Mock
    private LeaveByApi leaveByApi;

    @Mock
    private CoverageApi coverageApi;

    @Mock
    private RsvpApi rsvpApi;

    @Mock
    private AdultSessionApi adultSessionApi;

    @Mock
    private CarpoolApi carpoolApi;

    @Mock
    private com.yourorg.quickapp.playlist.RidePlaylistApi ridePlaylistApi;

    @Mock
    private DriveBlockEnricher driveBlockEnricher;

    @Mock
    private DriveBlockOverrideService driveBlockOverrideService;

    @Mock
    private DriveBlockRouteResolver driveBlockRouteResolver;

    @Mock
    private com.yourorg.quickapp.family.FamilyPlaceApi familyPlaceApi;

    @InjectMocks
    private CalendarService calendarService;

    private final AdultResponse adult =
            new AdultResponse(UUID.randomUUID(), "care@example.com", "Jordan");
    private final UUID circleId = UUID.randomUUID();

    @BeforeEach
    void stubLeaveByUnavailable() {
        lenient()
                .when(driveBlockEnricher.attach(any(), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));
        lenient()
                .when(driveBlockRouteResolver.resolve(any(), any(), any(), any(), any(), any()))
                .thenReturn(Optional.empty());
        lenient()
                .when(familyPlaceApi.findDefaultLeaveFromForMember(any()))
                .thenReturn(Optional.empty());
        lenient()
                .when(familyPlaceApi.listLocatedPlacesForMember(any()))
                .thenReturn(List.of());
        lenient()
                .when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(carpoolApi.listConfirmedHouseholdStopsForFeedEvent(any(), any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(carpoolApi.listConfirmedDrivingLegs(any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(coverageApi.listForItems(any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(feedCalendarApi.listEventsInRange(any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(leaveByApi.pickupLeaveFromForRouteMiddle(any(), any(), any()))
                .thenReturn(Optional.empty());
        lenient()
                .when(leaveByApi.enrich(any(), any(), any(), any(), any()))
                .thenReturn(LeaveByEnrichmentDto.unavailable(null, null, "NO_ORIGIN"));
        lenient()
                .when(leaveByApi.enrichCheapMany(any(), any()))
                .thenAnswer(
                        invocation -> {
                            List<LeaveByItemInput> inputs = invocation.getArgument(1);
                            if (inputs == null) {
                                return List.of();
                            }
                            return inputs.stream()
                                    .map(
                                            ignored ->
                                                    LeaveByEnrichmentDto.unavailable(
                                                            null, null, "NO_ORIGIN"))
                                    .toList();
                        });
        lenient()
                .when(leaveByApi.enrichMany(any(), any()))
                .thenAnswer(
                        invocation -> {
                            List<LeaveByItemInput> inputs = invocation.getArgument(1);
                            if (inputs == null) {
                                return List.of();
                            }
                            return inputs.stream()
                                    .map(
                                            ignored ->
                                                    LeaveByEnrichmentDto.unavailable(
                                                            null, null, "NO_ORIGIN"))
                                    .toList();
                        });
        lenient()
                .when(leaveByApi.enrichForLeaveFromMany(any(), anyBoolean()))
                .thenAnswer(
                        invocation -> {
                            List<?> inputs = invocation.getArgument(0);
                            if (inputs == null) {
                                return List.of();
                            }
                            return inputs.stream()
                                    .map(
                                            ignored ->
                                                    LeaveByEnrichmentDto.unavailable(
                                                            null, null, "NO_ORIGIN"))
                                    .toList();
                        });
        lenient().when(coverageApi.listForItems(any(), any(), any())).thenReturn(List.of());
        lenient().when(coverageApi.listForItem(any(), any(), any())).thenReturn(List.of());
        lenient().when(rsvpApi.listForItems(any(), any(), any())).thenReturn(List.of());
        lenient()
                .when(rsvpApi.setStatus(any(), any(), any(), any(), any(), any()))
                .thenAnswer(
                        inv ->
                                new RsvpDto(
                                        inv.getArgument(1),
                                        inv.getArgument(2),
                                        inv.getArgument(3),
                                        inv.getArgument(4)));
        lenient()
                .when(feedCalendarApi.listEventsOverlapping(any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(manualEventCalendarApi.listOverlapping(any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(carpoolApi.listAcceptedPickupsForFeedEvent(any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void mergesFeedAndManualOrderedByStartsAtThenSourceThenId() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);

        UUID feedEventId = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
        UUID manualEarlierId = UUID.fromString("00000000-0000-0000-0000-0000000000bb");
        UUID feedId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        FeedCalendarEventDto feedEvent =
                new FeedCalendarEventDto(
                        feedEventId,
                        feedId,
                        "U12",
                        "practice-uid@example.com",
                        "Practice",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        "Field 3",
                        List.of(kidId));

        when(feedCalendarApi.listEventsInRange(circleId, from, to))
                .thenReturn(List.of(feedEvent));
        when(manualEventCalendarApi.listInRange(circleId, from, to))
                .thenReturn(
                        List.of(
                                new ManualCalendarEventDto(
                                        manualEarlierId,
                                        "Dentist",
                                        Instant.parse("2026-08-15T16:00:00Z"),
                                        null,
                                        "Clinic",
                                        List.of(kidId))));

        List<CalendarItemResponse> items = calendarService.list(adult, from, to);

        assertThat(items).hasSize(2);
        assertThat(items.get(0).id()).isEqualTo(manualEarlierId);
        assertThat(items.get(0).source()).isEqualTo(CalendarItemSource.MANUAL);
        assertThat(items.get(0).feedId()).isNull();
        assertThat(items.get(0).eventKey()).isNull();
        assertThat(items.get(0).leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(items.get(0).uncoveredKidIds()).isEmpty();
        assertThat(items.get(0).coverages()).isEmpty();
        assertThat(items.get(0).rsvps())
                .singleElement()
                .satisfies(
                        rsvp -> {
                            assertThat(rsvp.kidId()).isEqualTo(kidId);
                            assertThat(rsvp.status()).isEqualTo(RsvpStatus.NO_RESPONSE);
                        });
        assertThat(items.get(1).source()).isEqualTo(CalendarItemSource.FEED);
        assertThat(items.get(1).feedName()).isEqualTo("U12");
        assertThat(items.get(1).kidIds()).containsExactly(kidId);
        assertThat(items.get(1).eventKey()).isEqualTo(FeedEventKey.of(feedEvent));
        verify(familyMembershipApi).requireMemberCircleId(adult.id());
        verify(leaveByApi).enrichCheapMany(eq(adult.id()), any());
        verify(leaveByApi, never()).enrich(any(), any(), any(), any(), any());
        verify(leaveByApi, never()).enrichMany(any(), any());
    }

    @Test
    void linkedManualMapsFeedIdFeedNameAndEventKey() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);

        UUID manualId = UUID.fromString("00000000-0000-0000-0000-0000000000cc");
        UUID feedId = UUID.fromString("00000000-0000-0000-0000-0000000000dd");
        UUID kidId = UUID.randomUUID();
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of());
        when(manualEventCalendarApi.listInRange(circleId, from, to))
                .thenReturn(
                        List.of(
                                new ManualCalendarEventDto(
                                        manualId,
                                        "Banquet",
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        null,
                                        "Hall",
                                        List.of(kidId),
                                        feedId,
                                        "U12")));

        List<CalendarItemResponse> items = calendarService.list(adult, from, to);

        assertThat(items).hasSize(1);
        assertThat(items.get(0).source()).isEqualTo(CalendarItemSource.MANUAL);
        assertThat(items.get(0).feedId()).isEqualTo(feedId);
        assertThat(items.get(0).feedName()).isEqualTo("U12");
        assertThat(items.get(0).eventKey()).isEqualTo("CAL:MANUAL:" + manualId);
        assertThat(items.get(0).uncoveredKidIds()).isEmpty();
    }

    @Test
    void feedItemWithoutUidUsesFingerprintEventKey() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        FeedCalendarEventDto feedEvent =
                new FeedCalendarEventDto(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "U12",
                        null,
                        "Practice",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        "Field 3",
                        List.of());
        when(feedCalendarApi.listEventsInRange(circleId, from, to))
                .thenReturn(List.of(feedEvent));
        when(manualEventCalendarApi.listInRange(circleId, from, to)).thenReturn(List.of());

        List<CalendarItemResponse> items = calendarService.list(adult, from, to);

        assertThat(items).hasSize(1);
        assertThat(items.getFirst().eventKey()).isEqualTo(FeedEventKey.of(feedEvent));
        assertThat(items.getFirst().eventKey())
                .isEqualTo("FP:practice|2026-08-15T17:00:00Z|field 3");
    }

    @Test
    void listAttachesCoverageAndUncoveredKids() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        UUID itemId = UUID.randomUUID();
        UUID kidCovered = UUID.randomUUID();
        UUID kidOpen = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of());
        when(manualEventCalendarApi.listInRange(circleId, from, to))
                .thenReturn(
                        List.of(
                                new ManualCalendarEventDto(
                                        itemId,
                                        "Game",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        "Rink",
                                        List.of(kidCovered, kidOpen))));
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidCovered),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.parse("2026-08-01T00:00:00Z"),
                        Instant.parse("2026-08-01T00:00:00Z"));
        when(coverageApi.listForItems(eq(circleId), eq(CoverageItemSource.MANUAL), any()))
                .thenReturn(List.of(coverage));
        when(rsvpApi.listForItems(eq(circleId), eq(RsvpItemSource.MANUAL), any()))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidCovered, RsvpStatus.YES),
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidOpen, RsvpStatus.YES)));
        when(adultSessionApi.requireAdult(adult.id())).thenReturn(adult);

        List<CalendarItemResponse> items = calendarService.list(adult, from, to);

        assertThat(items).hasSize(1);
        assertThat(items.getFirst().coverages()).hasSize(1);
        assertThat(items.getFirst().coverages().getFirst().coveringAdultDisplayName())
                .isEqualTo("Jordan");
        assertThat(items.getFirst().uncoveredKidIds()).containsExactly(kidOpen);
    }

    @Test
    void emptyWindowReturnsEmptyList() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of());
        when(manualEventCalendarApi.listInRange(circleId, from, to)).thenReturn(List.of());

        assertThat(calendarService.list(adult, from, to)).isEmpty();
    }

    @Test
    void fromNotBeforeToIsBadRequest() {
        Instant instant = Instant.parse("2026-08-15T00:00:00Z");
        assertThatThrownBy(() -> calendarService.list(adult, instant, instant))
                .isInstanceOf(CalendarException.class)
                .extracting(ex -> ((CalendarException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verifyNoInteractions(familyMembershipApi, feedCalendarApi, manualEventCalendarApi);
    }

    @Test
    void noMembershipPropagatesFamilyAccessException() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id()))
                .thenThrow(new FamilyAccessException(HttpStatus.NOT_FOUND, "Family circle not found"));

        assertThatThrownBy(() -> calendarService.list(adult, from, to))
                .isInstanceOf(FamilyAccessException.class);
        verifyNoInteractions(feedCalendarApi, manualEventCalendarApi);
    }

    @Test
    void setLeaveFromDelegatesToLeaveByApiAndReturnsEnrichedItem() {
        UUID itemId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "Practice", startsAt, null, "Rink", List.of(kidId))));
        when(leaveByApi.enrich(
                        adult.id(), LeaveByItemSource.MANUAL, itemId, startsAt, "Rink"))
                .thenReturn(
                        LeaveByEnrichmentDto.ok(
                                placeId, "Mom's house", Instant.parse("2026-08-15T16:30:00Z")));

        CalendarItemResponse response =
                calendarService.setLeaveFrom(adult, CalendarItemSource.MANUAL, itemId, placeId, null);

        verify(leaveByApi)
                .setLeaveFrom(adult.id(), LeaveByItemSource.MANUAL, itemId, placeId, null);
        verify(leaveByApi)
                .invalidateCalendarRoute(adult.id(), LeaveByItemSource.MANUAL, itemId);
        assertThat(response.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(response.leaveFromPlaceId()).isEqualTo(placeId);
        assertThat(response.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T16:30:00Z"));
        assertThat(response.uncoveredKidIds()).isEmpty();
        assertThat(response.eventKey()).isNull();
    }

    @Test
    void setCoverageLeaveFromDelegatesAndInvalidatesRouteWhenConfirmed() {
        UUID assignmentId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        CoverageAssignmentDto existing =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.parse("2026-08-01T00:00:00Z"),
                        Instant.parse("2026-08-01T00:00:00Z"));
        CoverageAssignmentDto updated =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        "Jack's house",
                        Instant.parse("2026-08-01T00:00:00Z"),
                        Instant.parse("2026-08-01T00:00:00Z"));
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(coverageApi.requireAssignment(adult.id(), assignmentId)).thenReturn(existing);
        when(coverageApi.setLeaveFrom(adult.id(), assignmentId, null, "Jack's house"))
                .thenReturn(updated);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "Practice", startsAt, null, "Rink", List.of(kidId))));
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of(updated));
        when(adultSessionApi.requireAdult(adult.id())).thenReturn(adult);
        when(leaveByApi.enrichForLeaveFromMany(any(), eq(true)))
                .thenReturn(
                        List.of(
                                LeaveByEnrichmentDto.ok(
                                        null,
                                        null,
                                        "Jack's house",
                                        Instant.parse("2026-08-15T16:20:00Z"))));
        when(leaveByApi.enrich(
                        adult.id(), LeaveByItemSource.MANUAL, itemId, startsAt, "Rink"))
                .thenReturn(
                        LeaveByEnrichmentDto.ok(
                                null,
                                null,
                                "Jack's house",
                                Instant.parse("2026-08-15T16:20:00Z")));

        CalendarItemResponse response =
                calendarService.setCoverageLeaveFrom(adult, assignmentId, null, "Jack's house");

        verify(coverageApi).setLeaveFrom(adult.id(), assignmentId, null, "Jack's house");
        verify(leaveByApi)
                .invalidateCalendarRoute(adult.id(), LeaveByItemSource.MANUAL, itemId);
        assertThat(response.leaveFromAddress()).isEqualTo("Jack's house");
        assertThat(response.coverages()).hasSize(1);
        assertThat(response.coverages().getFirst().leaveFromAddress()).isEqualTo("Jack's house");
        assertThat(response.coverages().getFirst().leaveByStatus()).isEqualTo(LeaveByStatus.OK);
    }

    @Test
    void listLeaveByUsesFullEnrichMany() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        UUID itemId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        Instant leaveByAt = Instant.parse("2026-08-15T16:30:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of());
        when(manualEventCalendarApi.listInRange(circleId, from, to))
                .thenReturn(
                        List.of(
                                new ManualCalendarEventDto(
                                        itemId, "Practice", startsAt, null, "Rink", List.of())));
        when(leaveByApi.enrichMany(eq(adult.id()), any()))
                .thenReturn(List.of(LeaveByEnrichmentDto.ok(placeId, "Mom's house", leaveByAt)));

        List<CalendarLeaveByResponse> rows = calendarService.listLeaveBy(adult, from, to);

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().id()).isEqualTo(itemId);
        assertThat(rows.getFirst().source()).isEqualTo(CalendarItemSource.MANUAL);
        assertThat(rows.getFirst().leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(rows.getFirst().leaveByAt()).isEqualTo(leaveByAt);
        assertThat(rows.getFirst().coverages()).isEmpty();
        verify(leaveByApi).enrichMany(eq(adult.id()), any());
        verify(leaveByApi, never()).enrichCheapMany(any(), any());
        verify(coverageApi).listForItems(eq(circleId), eq(CoverageItemSource.MANUAL), any());
    }

    @Test
    void listLeaveByFromNotBeforeToIsBadRequest() {
        Instant instant = Instant.parse("2026-08-15T00:00:00Z");
        assertThatThrownBy(() -> calendarService.listLeaveBy(adult, instant, instant))
                .isInstanceOf(CalendarException.class)
                .extracting(ex -> ((CalendarException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verifyNoInteractions(familyMembershipApi, feedCalendarApi, manualEventCalendarApi);
    }

    @Test
    void assignCoverageDelegatesAndReturnsItem() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "Practice", startsAt, null, "Rink", List.of(kidId))));
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.assign(
                        adult.id(),
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        List.of(kidId)))
                .thenReturn(coverage);
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of(coverage));
        when(adultSessionApi.requireAdult(adult.id())).thenReturn(adult);

        CalendarItemResponse response =
                calendarService.assignCoverage(
                        adult,
                        CalendarItemSource.MANUAL,
                        itemId,
                        new AssignCalendarCoverageRequest(adult.id(), List.of(kidId)));

        assertThat(response.coverages()).hasSize(1);
        assertThat(response.uncoveredKidIds()).isEmpty();
        verify(leaveByApi).enrich(adult.id(), LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");
        verify(leaveByApi, never()).enrichCheapMany(any(), any());
        verify(coverageApi)
                .assign(
                        adult.id(),
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        List.of(kidId));
        verify(rsvpApi)
                .setStatus(
                        circleId,
                        RsvpItemSource.MANUAL,
                        itemId,
                        kidId,
                        RsvpStatus.YES,
                        adult.id());
        verify(leaveByApi)
                .upsertCalendarRoute(
                        eq(adult.id()),
                        eq(LeaveByItemSource.MANUAL),
                        eq(itemId),
                        eq("Practice"),
                        eq(List.of()),
                        eq("Rink"),
                        eq("Rink"));
    }

    @Test
    void assignCoverageRejectsKidWithRsvpNo() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(rsvpApi.listForItems(eq(circleId), eq(RsvpItemSource.MANUAL), any()))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidId, RsvpStatus.NO)));

        assertThatThrownBy(
                        () ->
                                calendarService.assignCoverage(
                                        adult,
                                        CalendarItemSource.MANUAL,
                                        itemId,
                                        new AssignCalendarCoverageRequest(
                                                adult.id(), List.of(kidId))))
                .isInstanceOf(CalendarException.class)
                .extracting(ex -> ((CalendarException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(coverageApi, never()).assign(any(), any(), any(), any(), any());
    }

    @Test
    void setRsvpNoReleasesCoverageThenSaves() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId,
                                        "Practice",
                                        startsAt,
                                        null,
                                        "Rink",
                                        List.of(kidId))));
        when(rsvpApi.listForItems(eq(circleId), eq(RsvpItemSource.MANUAL), any()))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidId, RsvpStatus.NO)));

        CalendarItemResponse response =
                calendarService.setRsvp(
                        adult, CalendarItemSource.MANUAL, itemId, kidId, RsvpStatus.NO);

        verify(coverageApi)
                .releaseKidFromActiveRows(
                        circleId, CoverageItemSource.MANUAL, itemId, kidId);
        verify(carpoolApi, never()).clearTransportForNotGoingKid(any(), any(), any());
        verify(rsvpApi)
                .setStatus(
                        circleId,
                        RsvpItemSource.MANUAL,
                        itemId,
                        kidId,
                        RsvpStatus.NO,
                        adult.id());
        assertThat(response.rsvps())
                .singleElement()
                .satisfies(rsvp -> assertThat(rsvp.status()).isEqualTo(RsvpStatus.NO));
        assertThat(response.uncoveredKidIds()).isEmpty();
    }

    @Test
    void setRsvpNoOnFeedWithdrawsInboundWhenLastConfirmedCoverageReleased() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        feedId,
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        startsAt,
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field 3",
                                        List.of(kidId))));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(eq(circleId), eq(RsvpItemSource.FEED), any()))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.FEED, itemId, kidId, RsvpStatus.NO)));

        calendarService.setRsvp(adult, CalendarItemSource.FEED, itemId, kidId, RsvpStatus.NO);

        InOrder order = inOrder(coverageApi, carpoolApi, rsvpApi);
        order.verify(coverageApi)
                .releaseKidFromActiveRows(
                        circleId, CoverageItemSource.FEED, itemId, kidId);
        order.verify(carpoolApi).withdrawAcceptedInboundForFeedEvent(adult.id(), itemId);
        order.verify(carpoolApi).clearTransportForNotGoingKid(adult.id(), itemId, kidId);
        order.verify(rsvpApi)
                .setStatus(
                        circleId,
                        RsvpItemSource.FEED,
                        itemId,
                        kidId,
                        RsvpStatus.NO,
                        adult.id());
    }

    @Test
    void setRsvpNoOnFeedDoesNotWithdrawInboundWhenOtherConfirmedKidRemains() {
        UUID itemId = UUID.randomUUID();
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        feedId,
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        startsAt,
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field 3",
                                        List.of(kidA, kidB))));
        CoverageAssignmentDto remainingCoverage =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.FEED,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidB),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(List.of(remainingCoverage));
        when(coverageApi.listForItems(eq(circleId), eq(CoverageItemSource.FEED), any()))
                .thenReturn(List.of(remainingCoverage));
        when(adultSessionApi.requireAdult(adult.id())).thenReturn(adult);
        when(rsvpApi.listForItems(eq(circleId), eq(RsvpItemSource.FEED), any()))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.FEED, itemId, kidA, RsvpStatus.NO),
                                new RsvpDto(
                                        RsvpItemSource.FEED,
                                        itemId,
                                        kidB,
                                        RsvpStatus.NO_RESPONSE)));

        calendarService.setRsvp(adult, CalendarItemSource.FEED, itemId, kidA, RsvpStatus.NO);

        verify(coverageApi)
                .releaseKidFromActiveRows(
                        circleId, CoverageItemSource.FEED, itemId, kidA);
        verify(carpoolApi, never()).withdrawAcceptedInboundForFeedEvent(any(), any());
        verify(carpoolApi).clearTransportForNotGoingKid(adult.id(), itemId, kidA);
    }

    @Test
    void removeConfirmedFeedCoverageWithdrawsAcceptedInboundThenRemoves() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.FEED,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.requireAssignment(adult.id(), assignmentId)).thenReturn(coverage);
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        feedId,
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        startsAt,
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field 3",
                                        List.of(kidId))));

        CalendarItemResponse response = calendarService.removeCoverage(adult, assignmentId);

        InOrder order = inOrder(carpoolApi, coverageApi);
        order.verify(carpoolApi).withdrawAcceptedInboundForFeedEvent(adult.id(), itemId);
        order.verify(coverageApi).remove(adult.id(), assignmentId);
        assertThat(response.coverages()).isEmpty();
        assertThat(response.uncoveredKidIds()).containsExactly(kidId);
        verify(leaveByApi)
                .invalidateCalendarRoute(adult.id(), LeaveByItemSource.FEED, itemId);
    }

    @Test
    void removePendingFeedCoverageDoesNotWithdrawInbound() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.FEED,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.PENDING,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.requireAssignment(adult.id(), assignmentId)).thenReturn(coverage);
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        feedId,
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        startsAt,
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field 3",
                                        List.of(kidId))));

        calendarService.removeCoverage(adult, assignmentId);

        verify(carpoolApi, never()).withdrawAcceptedInboundForFeedEvent(any(), any());
        verify(coverageApi).remove(adult.id(), assignmentId);
    }

    @Test
    void removeConfirmedManualCoverageDoesNotWithdrawInbound() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.requireAssignment(adult.id(), assignmentId)).thenReturn(coverage);
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "Practice", startsAt, null, "Rink", List.of(kidId))));

        calendarService.removeCoverage(adult, assignmentId);

        verify(carpoolApi, never()).withdrawAcceptedInboundForFeedEvent(any(), any());
        verify(coverageApi).remove(adult.id(), assignmentId);
        verify(leaveByApi)
                .invalidateCalendarRoute(adult.id(), LeaveByItemSource.MANUAL, itemId);
    }

    @Test
    void confirmCoverageUpsertsDriverRoute() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        CoverageAssignmentDto confirmed =
                new CoverageAssignmentDto(
                        assignmentId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.confirm(adult.id(), assignmentId)).thenReturn(confirmed);
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "vs Thunder", startsAt, null, "Rink", List.of(kidId))));
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of(confirmed));
        when(adultSessionApi.requireAdult(adult.id())).thenReturn(adult);

        calendarService.confirmCoverage(adult, assignmentId);

        verify(leaveByApi)
                .upsertCalendarRoute(
                        eq(adult.id()),
                        eq(LeaveByItemSource.MANUAL),
                        eq(itemId),
                        eq("vs Thunder"),
                        eq(List.of()),
                        eq("Rink"),
                        eq("Rink"));
    }

    @Test
    void uncoveredKidIdsIgnoresDeclined() {
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        CoverageAssignmentDto declined =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.MANUAL,
                        UUID.randomUUID(),
                        adult.id(),
                        adult.id(),
                        List.of(kidA),
                        CoverageStatus.DECLINED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        assertThat(CalendarService.uncoveredKidIds(List.of(kidA, kidB), List.of(declined), List.of()))
                .containsExactly(kidA, kidB);
    }

    @Test
    void getRouteForConfirmedCoverageReturnsLeaveByItinerary() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "vs Thunder", startsAt, null, "Rink", List.of(kidId))));
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of(coverage));
        when(rsvpApi.listForItems(circleId, RsvpItemSource.MANUAL, List.of(itemId)))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidId, RsvpStatus.YES)));
        when(familyPlaceApi.findDefaultLeaveFromForMember(adult.id())).thenReturn(Optional.empty());
        when(familyPlaceApi.listLocatedPlacesForMember(adult.id())).thenReturn(List.of());
        when(leaveByApi.getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(com.yourorg.quickapp.leaveby.CalendarRouteLeg.TO),
                        any(),
                        eq(LeaveByItemSource.MANUAL),
                        eq(itemId),
                        eq("vs Thunder"),
                        eq(List.of()),
                        eq("Rink"),
                        eq("Rink")))
                .thenReturn(
                        CalendarRouteDto.ok(
                                45,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "Rink",
                                                CalendarRouteStopKind.DESTINATION,
                                                null)),
                                List.of(14)));

        CalendarRouteResponse route =
                calendarService.getRoute(adult, CalendarItemSource.MANUAL, itemId);

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.bufferMinutes()).isEqualTo(45);
        assertThat(route.legMinutes()).containsExactly(14);
        assertThat(route.stops()).hasSize(2);
    }

    @Test
    void reorderRouteCallsLeaveByWhenCallerIsDrivingAdult() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "vs Thunder", startsAt, null, "Rink", List.of(kidId))));
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of(coverage));
        when(rsvpApi.listForItems(circleId, RsvpItemSource.MANUAL, List.of(itemId)))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidId, RsvpStatus.YES)));
        when(familyPlaceApi.findDefaultLeaveFromForMember(adult.id())).thenReturn(Optional.empty());
        when(familyPlaceApi.listLocatedPlacesForMember(adult.id())).thenReturn(List.of());
        when(leaveByApi.reorderCalendarRouteMiddles(
                        eq(adult.id()),
                        eq(com.yourorg.quickapp.leaveby.CalendarRouteLeg.TO),
                        any(),
                        eq(List.of("B St", "A St"))))
                .thenReturn(
                        CalendarRouteDto.ok(
                                45,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "B", "B St", CalendarRouteStopKind.PICKUP, null),
                                        new CalendarRouteStopDto(
                                                "A", "A St", CalendarRouteStopKind.PICKUP, null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "Rink",
                                                CalendarRouteStopKind.DESTINATION,
                                                null)),
                                List.of(10, 12, 14)));

        CalendarRouteResponse route =
                calendarService.reorderRoute(
                        adult, CalendarItemSource.MANUAL, itemId, List.of("B St", "A St"));

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().get(1).address()).isEqualTo("B St");
        assertThat(route.legMinutes()).containsExactly(10, 12, 14);
    }

    @Test
    void reorderRouteForbiddenWhenCallerIsNotDrivingAdult() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID driverAdultId = UUID.randomUUID();
        UUID driverCircleId = UUID.randomUUID();
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        UUID.randomUUID(),
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        "Rink",
                                        List.of(kidId))));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(itemId)))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.FEED, itemId, kidId, RsvpStatus.YES)));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(eq(circleId), eq(itemId), any()))
                .thenReturn(
                        List.of(
                                new com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto(
                                        driverAdultId,
                                        driverCircleId,
                                        circleId,
                                        "Far kid",
                                        "Far St",
                                        List.of(kidId))));

        assertThatThrownBy(
                        () ->
                                calendarService.reorderRoute(
                                        adult,
                                        CalendarItemSource.FEED,
                                        itemId,
                                        List.of("Far St")))
                .isInstanceOf(CalendarException.class)
                .extracting(ex -> ((CalendarException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
        verify(leaveByApi, never())
                .reorderCalendarRouteMiddles(
                        any(),
                        any(com.yourorg.quickapp.leaveby.CalendarRouteLeg.class),
                        any(),
                        any());
    }

    @Test
    void setRouteOriginCallsLeaveByWhenCallerIsDrivingAdult() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID officeId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId, "vs Thunder", startsAt, null, "Rink", List.of(kidId))));
        CoverageAssignmentDto coverage =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.MANUAL,
                        itemId,
                        adult.id(),
                        adult.id(),
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of(coverage));
        when(rsvpApi.listForItems(circleId, RsvpItemSource.MANUAL, List.of(itemId)))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.MANUAL, itemId, kidId, RsvpStatus.YES)));
        when(familyPlaceApi.findDefaultLeaveFromForMember(adult.id())).thenReturn(Optional.empty());
        when(familyPlaceApi.listLocatedPlacesForMember(adult.id())).thenReturn(List.of());
        when(leaveByApi.setCalendarRouteOrigin(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        any(),
                        eq(LeaveByItemSource.MANUAL),
                        eq(itemId),
                        eq("vs Thunder"),
                        any(),
                        eq("Rink"),
                        eq("Rink"),
                        eq(officeId),
                        isNull()))
                .thenReturn(
                        CalendarRouteDto.ok(
                                45,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Office",
                                                "500 Market",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "Rink",
                                                CalendarRouteStopKind.DESTINATION,
                                                null)),
                                List.of(15),
                                CalendarRouteLeg.TO,
                                List.of(
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.MANUAL, itemId))));

        CalendarRouteResponse route =
                calendarService.setRouteOrigin(
                        adult,
                        CalendarItemSource.MANUAL,
                        itemId,
                        CalendarRouteLeg.TO,
                        officeId,
                        null);

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().name()).isEqualTo("Office");
        assertThat(route.stops().getFirst().address()).isEqualTo("500 Market");
    }

    @Test
    void setRouteOriginForbiddenWhenCallerIsNotDrivingAdult() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID driverAdultId = UUID.randomUUID();
        UUID driverCircleId = UUID.randomUUID();
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        UUID.randomUUID(),
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        "Rink",
                                        List.of(kidId))));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(itemId)))
                .thenReturn(
                        List.of(
                                new RsvpDto(
                                        RsvpItemSource.FEED, itemId, kidId, RsvpStatus.YES)));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(eq(circleId), eq(itemId), any()))
                .thenReturn(
                        List.of(
                                new com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto(
                                        driverAdultId,
                                        driverCircleId,
                                        circleId,
                                        "Far kid",
                                        "Far St",
                                        List.of(kidId))));

        assertThatThrownBy(
                        () ->
                                calendarService.setRouteOrigin(
                                        adult,
                                        CalendarItemSource.FEED,
                                        itemId,
                                        CalendarRouteLeg.TO,
                                        UUID.randomUUID(),
                                        null))
                .isInstanceOf(CalendarException.class)
                .extracting(ex -> ((CalendarException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
        verify(leaveByApi, never())
                .setCalendarRouteOrigin(
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any());
    }

    @Test
    void getRouteForbiddenWhenCallerCannotRoute() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId,
                                        "Dentist",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        "Clinic",
                                        List.of(kidId))));
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.MANUAL, List.of(itemId)))
                .thenReturn(List.of());

        assertThatThrownBy(
                        () -> calendarService.getRoute(adult, CalendarItemSource.MANUAL, itemId))
                .isInstanceOf(CalendarException.class)
                .extracting(ex -> ((CalendarException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
        verify(leaveByApi, never())
                .getOrRefreshCalendarRoute(
                        any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void uncoveredKidIdsExcludesRsvpNo() {
        UUID kidYes = UUID.randomUUID();
        UUID kidNo = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        assertThat(
                        CalendarService.uncoveredKidIds(
                                CalendarItemSource.FEED,
                                List.of(kidYes, kidNo),
                                List.of(),
                                List.of(
                                        new RsvpDto(
                                                RsvpItemSource.FEED,
                                                itemId,
                                                kidNo,
                                                RsvpStatus.NO))))
                .containsExactly(kidYes);
    }

    @Test
    void uncoveredKidIdsManualRequiresYes() {
        UUID kidYes = UUID.randomUUID();
        UUID kidSilent = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        assertThat(
                        CalendarService.uncoveredKidIds(
                                CalendarItemSource.MANUAL,
                                List.of(kidYes, kidSilent),
                                List.of(),
                                List.of(
                                        new RsvpDto(
                                                RsvpItemSource.MANUAL,
                                                itemId,
                                                kidYes,
                                                RsvpStatus.YES))))
                .containsExactly(kidYes);
        assertThat(
                        CalendarService.uncoveredKidIds(
                                CalendarItemSource.MANUAL,
                                List.of(kidSilent),
                                List.of(),
                                List.of(
                                        new RsvpDto(
                                                RsvpItemSource.MANUAL,
                                                itemId,
                                                kidSilent,
                                                RsvpStatus.NO_RESPONSE))))
                .isEmpty();
    }

    @Test
    void inPlayKidIdsExcludesNo() {
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        assertThat(
                        CalendarService.inPlayKidIds(
                                List.of(kidA, kidB),
                                List.of(
                                        new RsvpDto(
                                                RsvpItemSource.MANUAL,
                                                itemId,
                                                kidA,
                                                RsvpStatus.NO))))
                .containsExactly(kidB);
    }

    @Test
    void getRouteCombinedToBlockAssemblesPickupsAcrossMembersAndUsesEarliestTitle() {
        UUID itemA = UUID.randomUUID();
        UUID itemB = UUID.randomUUID();
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        UUID requesterCircle = UUID.randomUUID();
        Instant startsA = Instant.parse("2026-08-15T17:00:00Z");
        Instant startsB = Instant.parse("2026-08-15T18:00:00Z");
        UUID feedId = UUID.randomUUID();

        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(requesterCircle, "House Requester")));
        stubFeedEvent(itemA, feedId, "Practice A", startsA, kidA);
        stubFeedEvent(itemB, feedId, "Practice B", startsB, kidB);
        when(coverageApi.listForItem(eq(circleId), eq(CoverageItemSource.FEED), any()))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(itemB)))
                .thenReturn(List.of(new RsvpDto(RsvpItemSource.FEED, itemB, kidB, RsvpStatus.YES)));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), eq(itemA), eq(CarpoolLegKind.TO)))
                .thenReturn(
                        List.of(
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "Home B",
                                        "34 Pine St",
                                        List.of(kidA))));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), eq(itemB), eq(CarpoolLegKind.TO)))
                .thenReturn(
                        List.of(
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "School",
                                        "2 School Rd",
                                        List.of(kidB))));
        when(driveBlockRouteResolver.resolve(
                        eq(adult.id()),
                        eq(circleId),
                        eq(CalendarItemSource.FEED),
                        eq(itemB),
                        eq(CarpoolLegKind.TO),
                        any()))
                .thenReturn(
                        Optional.of(
                                new DrivingBlockComputer.DriveBlock(
                                        CarpoolLegKind.TO,
                                        List.of(
                                                new DrivingBlockComputer.ItemRef(
                                                        CalendarItemSource.FEED, itemA),
                                                new DrivingBlockComputer.ItemRef(
                                                        CalendarItemSource.FEED, itemB)))));
        when(leaveByApi.getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        any(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemA),
                        eq("Practice A"),
                        any(),
                        eq("Field 3"),
                        eq("Field 3")))
                .thenReturn(
                        CalendarRouteDto.ok(
                                20,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Home B (House Requester)",
                                                "34 Pine St",
                                                CalendarRouteStopKind.PICKUP,
                                                null),
                                        new CalendarRouteStopDto(
                                                "School (House Requester)",
                                                "2 School Rd",
                                                CalendarRouteStopKind.PICKUP,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Field 3",
                                                "Field 3",
                                                CalendarRouteStopKind.DESTINATION,
                                                null)),
                                List.of(10, 12, 14),
                                CalendarRouteLeg.TO,
                                List.of(
                                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemA),
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.FEED, itemB))));

        CalendarRouteResponse route =
                calendarService.getRoute(
                        adult, CalendarItemSource.FEED, itemB, CalendarRouteLeg.TO);

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.leg()).isEqualTo(CalendarRouteLeg.TO);
        assertThat(route.memberItemIds()).hasSize(2);
        assertThat(route.stops()).hasSize(4);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CalendarRoutePickupInput>> middles =
                ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<CalendarRouteMemberRef>> members =
                ArgumentCaptor.forClass(List.class);
        verify(leaveByApi)
                .getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        members.capture(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemA),
                        eq("Practice A"),
                        middles.capture(),
                        eq("Field 3"),
                        eq("Field 3"));
        assertThat(members.getValue())
                .containsExactly(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemA),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemB));
        assertThat(middles.getValue())
                .extracting(CalendarRoutePickupInput::address)
                .containsExactlyInAnyOrder("34 Pine St", "2 School Rd");
        assertThat(middles.getValue())
                .allMatch(m -> m.kind() == CalendarRouteStopKind.PICKUP);
    }

    @Test
    void getRouteCombinedToIncludesHouseholdPlanPickupPlaces() {
        UUID itemA = UUID.randomUUID();
        UUID itemB = UUID.randomUUID();
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        UUID requesterCircle = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsA = Instant.parse("2026-08-15T17:00:00Z");
        Instant startsB = Instant.parse("2026-08-15T18:00:00Z");

        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(requesterCircle, "House Requester")));
        when(familyMembershipApi.findKids(eq(circleId), any()))
                .thenAnswer(
                        inv -> {
                            @SuppressWarnings("unchecked")
                            java.util.Collection<UUID> ids = inv.getArgument(1);
                            List<com.yourorg.quickapp.family.FamilyKidName> names =
                                    new ArrayList<>();
                            if (ids.contains(kidA)) {
                                names.add(
                                        new com.yourorg.quickapp.family.FamilyKidName(
                                                kidA, "Kian"));
                            }
                            if (ids.contains(kidB)) {
                                names.add(
                                        new com.yourorg.quickapp.family.FamilyKidName(
                                                kidB, "Declan"));
                            }
                            return names;
                        });
        stubFeedEvent(itemA, feedId, "Practice A", startsA, kidA);
        stubFeedEvent(itemB, feedId, "Practice B", startsB, kidB);
        when(coverageApi.listForItem(eq(circleId), eq(CoverageItemSource.FEED), any()))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(itemA)))
                .thenReturn(List.of(new RsvpDto(RsvpItemSource.FEED, itemA, kidA, RsvpStatus.YES)));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), eq(itemA), eq(CarpoolLegKind.TO)))
                .thenReturn(
                        List.of(
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "Apollo house",
                                        "34 Pine St",
                                        List.of(kidA))));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), eq(itemB), eq(CarpoolLegKind.TO)))
                .thenReturn(List.of());
        when(carpoolApi.listConfirmedHouseholdStopsForFeedEvent(
                        eq(adult.id()), eq(circleId), eq(itemA), eq(CarpoolLegKind.TO)))
                .thenReturn(
                        List.of(
                                new CarpoolHouseholdStopDto(
                                        itemA,
                                        CarpoolLegKind.TO,
                                        "Haggerty",
                                        "9 School Rd",
                                        List.of(kidA))));
        when(carpoolApi.listConfirmedHouseholdStopsForFeedEvent(
                        eq(adult.id()), eq(circleId), eq(itemB), eq(CarpoolLegKind.TO)))
                .thenReturn(
                        List.of(
                                new CarpoolHouseholdStopDto(
                                        itemB,
                                        CarpoolLegKind.TO,
                                        "Russell CC",
                                        "1 Community Way",
                                        List.of(kidB))));
        when(leaveByApi.pickupLeaveFromForRouteMiddle(
                        eq(adult.id()), eq(LeaveByItemSource.FEED), eq(itemA)))
                .thenReturn(
                        Optional.of(
                                new LeaveFromPlaceDto(null, "Haggerty", "9 School Rd")));
        when(leaveByApi.pickupLeaveFromForRouteMiddle(
                        eq(adult.id()), eq(LeaveByItemSource.FEED), eq(itemB)))
                .thenReturn(Optional.empty());
        when(driveBlockRouteResolver.resolve(
                        eq(adult.id()),
                        eq(circleId),
                        eq(CalendarItemSource.FEED),
                        eq(itemA),
                        eq(CarpoolLegKind.TO),
                        any()))
                .thenReturn(
                        Optional.of(
                                new DrivingBlockComputer.DriveBlock(
                                        CarpoolLegKind.TO,
                                        List.of(
                                                new DrivingBlockComputer.ItemRef(
                                                        CalendarItemSource.FEED, itemA),
                                                new DrivingBlockComputer.ItemRef(
                                                        CalendarItemSource.FEED, itemB)))));
        when(leaveByApi.getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        any(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemA),
                        eq("Practice A"),
                        any(),
                        eq("Field 3"),
                        eq("Field 3")))
                .thenReturn(
                        CalendarRouteDto.ok(
                                20,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Field 3",
                                                "Field 3",
                                                CalendarRouteStopKind.DESTINATION,
                                                null)),
                                List.of(14),
                                CalendarRouteLeg.TO,
                                List.of(
                                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemA),
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.FEED, itemB))));

        calendarService.getRoute(adult, CalendarItemSource.FEED, itemA, CalendarRouteLeg.TO);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CalendarRoutePickupInput>> middles =
                ArgumentCaptor.forClass(List.class);
        verify(leaveByApi)
                .getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        any(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemA),
                        eq("Practice A"),
                        middles.capture(),
                        eq("Field 3"),
                        eq("Field 3"));
        assertThat(middles.getValue())
                .extracting(CalendarRoutePickupInput::address)
                .containsExactlyInAnyOrder("9 School Rd", "1 Community Way", "34 Pine St");
    }

    @Test
    void getRouteFromLegAssemblesDropoffsAndVenueStartShape() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID requesterCircle = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");

        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(requesterCircle, "House Requester")));
        stubFeedEvent(itemId, feedId, "Practice", startsAt, kidId);
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(itemId)))
                .thenReturn(
                        List.of(new RsvpDto(RsvpItemSource.FEED, itemId, kidId, RsvpStatus.YES)));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), eq(itemId), eq(CarpoolLegKind.FROM)))
                .thenReturn(
                        List.of(
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "Home B",
                                        "34 Pine St",
                                        List.of(kidId))));
        // Empty resolve → singleton; confirmed FROM unlocks the leg gate.
        when(driveBlockRouteResolver.resolve(
                        eq(adult.id()),
                        eq(circleId),
                        eq(CalendarItemSource.FEED),
                        eq(itemId),
                        eq(CarpoolLegKind.FROM),
                        any()))
                .thenReturn(Optional.empty());
        when(carpoolApi.listConfirmedDrivingLegs(adult.id(), circleId, List.of(itemId)))
                .thenReturn(
                        List.of(new CarpoolConfirmedDrivingLegDto(itemId, CarpoolLegKind.FROM)));
        when(leaveByApi.getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.FROM),
                        any(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemId),
                        eq("Practice"),
                        any(),
                        eq("Field 3"),
                        eq("Field 3")))
                .thenReturn(
                        CalendarRouteDto.ok(
                                20,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Field 3",
                                                "Field 3",
                                                CalendarRouteStopKind.DESTINATION,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Home B (House Requester)",
                                                "34 Pine St",
                                                CalendarRouteStopKind.DROPOFF,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null)),
                                List.of(10, 8),
                                CalendarRouteLeg.FROM,
                                List.of(
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.FEED, itemId))));

        CalendarRouteResponse route =
                calendarService.getRoute(
                        adult, CalendarItemSource.FEED, itemId, CalendarRouteLeg.FROM);

        assertThat(route.leg()).isEqualTo(CalendarRouteLeg.FROM);
        assertThat(route.stops().get(1).kind()).isEqualTo(CalendarRouteStopKind.DROPOFF);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CalendarRoutePickupInput>> middles =
                ArgumentCaptor.forClass(List.class);
        verify(leaveByApi)
                .getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.FROM),
                        any(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemId),
                        eq("Practice"),
                        middles.capture(),
                        eq("Field 3"),
                        eq("Field 3"));
        assertThat(middles.getValue())
                .singleElement()
                .satisfies(
                        m -> {
                            assertThat(m.address()).isEqualTo("34 Pine St");
                            assertThat(m.kind()).isEqualTo(CalendarRouteStopKind.DROPOFF);
                        });
    }

    @Test
    void getRouteSameCombinedMembersViaEitherItemId() {
        UUID itemA = UUID.randomUUID();
        UUID itemB = UUID.randomUUID();
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        UUID requesterCircle = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsA = Instant.parse("2026-08-15T17:00:00Z");
        Instant startsB = Instant.parse("2026-08-15T18:00:00Z");
        DrivingBlockComputer.DriveBlock combined =
                new DrivingBlockComputer.DriveBlock(
                        CarpoolLegKind.TO,
                        List.of(
                                new DrivingBlockComputer.ItemRef(CalendarItemSource.FEED, itemA),
                                new DrivingBlockComputer.ItemRef(CalendarItemSource.FEED, itemB)));

        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(requesterCircle, "House Requester")));
        stubFeedEvent(itemA, feedId, "Practice A", startsA, kidA);
        stubFeedEvent(itemB, feedId, "Practice B", startsB, kidB);
        when(coverageApi.listForItem(eq(circleId), eq(CoverageItemSource.FEED), any()))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(eq(circleId), eq(RsvpItemSource.FEED), any()))
                .thenAnswer(
                        inv -> {
                            @SuppressWarnings("unchecked")
                            List<UUID> ids = inv.getArgument(2);
                            UUID id = ids.getFirst();
                            UUID kid = id.equals(itemA) ? kidA : kidB;
                            return List.of(
                                    new RsvpDto(RsvpItemSource.FEED, id, kid, RsvpStatus.YES));
                        });
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), any(), eq(CarpoolLegKind.TO)))
                .thenReturn(
                        List.of(
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "Home B",
                                        "34 Pine St",
                                        List.of(kidA, kidB))));
        when(driveBlockRouteResolver.resolve(
                        eq(adult.id()),
                        eq(circleId),
                        eq(CalendarItemSource.FEED),
                        any(),
                        eq(CarpoolLegKind.TO),
                        any()))
                .thenReturn(Optional.of(combined));
        when(leaveByApi.getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        any(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemA),
                        eq("Practice A"),
                        any(),
                        eq("Field 3"),
                        eq("Field 3")))
                .thenReturn(
                        CalendarRouteDto.ok(
                                20,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Field 3",
                                                "Field 3",
                                                CalendarRouteStopKind.DESTINATION,
                                                null)),
                                List.of(14),
                                CalendarRouteLeg.TO,
                                List.of(
                                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemA),
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.FEED, itemB))));

        calendarService.getRoute(adult, CalendarItemSource.FEED, itemA, CalendarRouteLeg.TO);
        calendarService.getRoute(adult, CalendarItemSource.FEED, itemB, CalendarRouteLeg.TO);

        ArgumentCaptor<List<CalendarRouteMemberRef>> members =
                ArgumentCaptor.forClass(List.class);
        verify(leaveByApi, org.mockito.Mockito.times(2))
                .getOrRefreshCalendarRoute(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.TO),
                        members.capture(),
                        eq(LeaveByItemSource.FEED),
                        eq(itemA),
                        eq("Practice A"),
                        any(),
                        eq("Field 3"),
                        eq("Field 3"));
        assertThat(members.getAllValues().get(0)).isEqualTo(members.getAllValues().get(1));
        assertThat(members.getValue())
                .containsExactly(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemA),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemB));
    }

    @Test
    void reorderRouteFromLegPassesLegScopedMembers() {
        UUID itemId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID requesterCircle = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");

        when(familyMembershipApi.requireMemberCircleId(adult.id())).thenReturn(circleId);
        when(familyMembershipApi.findCircles(any()))
                .thenReturn(List.of(new FamilyCircleName(requesterCircle, "House Requester")));
        stubFeedEvent(itemId, feedId, "Practice", startsAt, kidId);
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(List.of());
        when(rsvpApi.listForItems(circleId, RsvpItemSource.FEED, List.of(itemId)))
                .thenReturn(
                        List.of(new RsvpDto(RsvpItemSource.FEED, itemId, kidId, RsvpStatus.YES)));
        when(carpoolApi.listAcceptedFamilyStopsForFeedEvent(
                        eq(circleId), eq(itemId), eq(CarpoolLegKind.FROM)))
                .thenReturn(
                        List.of(
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "Near",
                                        "Near St",
                                        List.of(kidId)),
                                new CarpoolAcceptedPickupDto(
                                        adult.id(),
                                        circleId,
                                        requesterCircle,
                                        "Far",
                                        "Far St",
                                        List.of(kidId))));
        when(driveBlockRouteResolver.resolve(
                        eq(adult.id()),
                        eq(circleId),
                        eq(CalendarItemSource.FEED),
                        eq(itemId),
                        eq(CarpoolLegKind.FROM),
                        any()))
                .thenReturn(Optional.empty());
        when(carpoolApi.listConfirmedDrivingLegs(adult.id(), circleId, List.of(itemId)))
                .thenReturn(
                        List.of(new CarpoolConfirmedDrivingLegDto(itemId, CarpoolLegKind.FROM)));
        when(leaveByApi.reorderCalendarRouteMiddles(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.FROM),
                        any(),
                        eq(List.of("Far St", "Near St"))))
                .thenReturn(
                        CalendarRouteDto.ok(
                                20,
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Field 3",
                                                "Field 3",
                                                CalendarRouteStopKind.DESTINATION,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Far",
                                                "Far St",
                                                CalendarRouteStopKind.DROPOFF,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Near",
                                                "Near St",
                                                CalendarRouteStopKind.DROPOFF,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Home",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null)),
                                List.of(10, 12, 8),
                                CalendarRouteLeg.FROM,
                                List.of(
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.FEED, itemId))));

        CalendarRouteResponse route =
                calendarService.reorderRoute(
                        adult,
                        CalendarItemSource.FEED,
                        itemId,
                        List.of("Far St", "Near St"),
                        CalendarRouteLeg.FROM);

        assertThat(route.stops().get(1).address()).isEqualTo("Far St");
        verify(leaveByApi)
                .reorderCalendarRouteMiddles(
                        eq(adult.id()),
                        eq(CalendarRouteLeg.FROM),
                        any(),
                        eq(List.of("Far St", "Near St")));
    }

    private void stubFeedEvent(
            UUID itemId, UUID feedId, String title, Instant startsAt, UUID kidId) {
        when(feedCalendarApi.findEventInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new FeedCalendarEventDto(
                                        itemId,
                                        feedId,
                                        "U12",
                                        title.toLowerCase().replace(' ', '-') + "@example.com",
                                        title,
                                        startsAt,
                                        startsAt.plusSeconds(3600),
                                        "Field 3",
                                        List.of(kidId))));
    }
}
