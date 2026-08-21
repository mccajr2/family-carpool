package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    @InjectMocks
    private CalendarService calendarService;

    private final AdultResponse adult =
            new AdultResponse(UUID.randomUUID(), "care@example.com", "Jordan");
    private final UUID circleId = UUID.randomUUID();

    @BeforeEach
    void stubLeaveByUnavailable() {
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

        when(feedCalendarApi.listEventsInRange(circleId, from, to))
                .thenReturn(
                        List.of(
                                new FeedCalendarEventDto(
                                        feedEventId,
                                        feedId,
                                        "U12",
                                        "practice-uid@example.com",
                                        "Practice",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field 3",
                                        List.of(kidId))));
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
        assertThat(items.get(0).leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(items.get(0).uncoveredKidIds()).containsExactly(kidId);
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
        verify(familyMembershipApi).requireMemberCircleId(adult.id());
        verify(leaveByApi).enrichCheapMany(eq(adult.id()), any());
        verify(leaveByApi, never()).enrich(any(), any(), any(), any(), any());
        verify(leaveByApi, never()).enrichMany(any(), any());
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
                        Instant.parse("2026-08-01T00:00:00Z"),
                        Instant.parse("2026-08-01T00:00:00Z"));
        when(coverageApi.listForItems(eq(circleId), eq(CoverageItemSource.MANUAL), any()))
                .thenReturn(List.of(coverage));
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
                calendarService.setLeaveFrom(adult, CalendarItemSource.MANUAL, itemId, placeId);

        verify(leaveByApi)
                .setLeaveFrom(adult.id(), LeaveByItemSource.MANUAL, itemId, placeId);
        assertThat(response.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(response.leaveFromPlaceId()).isEqualTo(placeId);
        assertThat(response.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T16:30:00Z"));
        assertThat(response.uncoveredKidIds()).containsExactly(kidId);
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
        verify(leaveByApi).enrichMany(eq(adult.id()), any());
        verify(leaveByApi, never()).enrichCheapMany(any(), any());
        verifyNoInteractions(coverageApi);
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
                        Instant.now(),
                        Instant.now());
        assertThat(CalendarService.uncoveredKidIds(List.of(kidA, kidB), List.of(declined), List.of()))
                .containsExactly(kidA, kidB);
    }

    @Test
    void uncoveredKidIdsExcludesRsvpNo() {
        UUID kidYes = UUID.randomUUID();
        UUID kidNo = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        assertThat(
                        CalendarService.uncoveredKidIds(
                                List.of(kidYes, kidNo),
                                List.of(),
                                List.of(
                                        new RsvpDto(
                                                RsvpItemSource.MANUAL,
                                                itemId,
                                                kidNo,
                                                RsvpStatus.NO))))
                .containsExactly(kidYes);
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
}
