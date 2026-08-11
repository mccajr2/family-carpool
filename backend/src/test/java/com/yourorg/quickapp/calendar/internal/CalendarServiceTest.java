package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
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
        assertThat(items.get(1).source()).isEqualTo(CalendarItemSource.FEED);
        assertThat(items.get(1).feedName()).isEqualTo("U12");
        assertThat(items.get(1).kidIds()).containsExactly(kidId);
        verify(familyMembershipApi).requireMemberCircleId(adult.id());
        verify(leaveByApi)
                .enrich(
                        eq(adult.id()),
                        eq(LeaveByItemSource.MANUAL),
                        eq(manualEarlierId),
                        any(),
                        eq("Clinic"));
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
    }
}
