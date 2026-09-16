package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.calendar.CalendarDriveBlockLinkResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
import com.yourorg.quickapp.leaveby.LeaveByVenueDriveDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DriveBlockEnricherTest {

    @Mock
    private CarpoolApi carpoolApi;

    @Mock
    private LeaveByApi leaveByApi;

    @Mock
    private DriveBlockOverrideService overrideService;

    @InjectMocks
    private DriveBlockEnricher enricher;

    private final UUID adultId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID item1 = UUID.randomUUID();
    private final UUID item2 = UUID.randomUUID();
    private final String rink =
            DrivingBlockComputer.venueIdentity(42.373600, -71.109700);

    @Test
    void leavesItemsUntouchedWhenNoConfirmedDrivingLegs() {
        CalendarItemResponse a = feedItem(item1, "Practice", Instant.parse("2026-09-15T17:00:00Z"));
        when(carpoolApi.listConfirmedDrivingLegs(adultId, circleId, List.of(item1)))
                .thenReturn(List.of());

        List<CalendarItemResponse> result = enricher.attach(adultId, circleId, List.of(a));

        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item.driveBlockLinks()).isEmpty();
        });
        verifyNoInteractions(leaveByApi, overrideService);
    }

    @Test
    void attachesCombinedLinkForSameVenueBackToBackConfirmedToLegs() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1;
        CalendarItemResponse a = feedItem(item1, "Practice A", start1, end1);
        CalendarItemResponse b = feedItem(item2, "Practice B", start2, start2.plusSeconds(3600));

        when(carpoolApi.listConfirmedDrivingLegs(eq(adultId), eq(circleId), any()))
                .thenReturn(
                        List.of(
                                new CarpoolConfirmedDrivingLegDto(item1, CarpoolLegKind.TO),
                                new CarpoolConfirmedDrivingLegDto(item2, CarpoolLegKind.TO)));
        when(leaveByApi.cheapVenueDrives(eq(adultId), any()))
                .thenReturn(
                        List.of(
                                new LeaveByVenueDriveDto(rink, 600),
                                new LeaveByVenueDriveDto(rink, 600)));
        when(leaveByApi.arrivalBufferMinutes("Practice A")).thenReturn(20);
        when(leaveByApi.arrivalBufferMinutes("Practice B")).thenReturn(20);
        when(overrideService.pairOverridesForAdult(adultId)).thenReturn(List.of());

        List<CalendarItemResponse> result = enricher.attach(adultId, circleId, List.of(a, b));

        assertThat(result.get(0).driveBlockLinks())
                .singleElement()
                .satisfies(
                        link -> {
                            assertThat(link.leg()).isEqualTo(CarpoolLegKind.TO);
                            assertThat(link.otherId()).isEqualTo(item2);
                            assertThat(link.otherTitle()).isEqualTo("Practice B");
                            assertThat(link.otherStartsAt()).isEqualTo(start2);
                            assertThat(link.combined()).isTrue();
                            assertThat(link.overrideAction()).isNull();
                        });
        assertThat(result.get(1).driveBlockLinks())
                .singleElement()
                .satisfies(
                        link -> {
                            assertThat(link.otherId()).isEqualTo(item1);
                            assertThat(link.otherTitle()).isEqualTo("Practice A");
                            assertThat(link.combined()).isTrue();
                        });
    }

    @Test
    void emitsOnlyToLinksWhenAdultConfirmedOnToAndFrom() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1.plus(10, java.time.temporal.ChronoUnit.MINUTES);
        CalendarItemResponse a = feedItem(item1, "Mite Practice", start1, end1);
        CalendarItemResponse b = feedItem(item2, "Squirt Practice", start2, start2.plusSeconds(3600));

        when(carpoolApi.listConfirmedDrivingLegs(eq(adultId), eq(circleId), any()))
                .thenReturn(
                        List.of(
                                new CarpoolConfirmedDrivingLegDto(item1, CarpoolLegKind.TO),
                                new CarpoolConfirmedDrivingLegDto(item1, CarpoolLegKind.FROM),
                                new CarpoolConfirmedDrivingLegDto(item2, CarpoolLegKind.TO),
                                new CarpoolConfirmedDrivingLegDto(item2, CarpoolLegKind.FROM)));
        when(leaveByApi.cheapVenueDrives(eq(adultId), any()))
                .thenReturn(
                        List.of(
                                new LeaveByVenueDriveDto(rink, 600),
                                new LeaveByVenueDriveDto(rink, 600)));
        when(leaveByApi.arrivalBufferMinutes(any())).thenReturn(20);
        when(overrideService.pairOverridesForAdult(adultId)).thenReturn(List.of());

        List<CalendarItemResponse> result = enricher.attach(adultId, circleId, List.of(a, b));

        assertThat(result.get(0).driveBlockLinks()).singleElement().satisfies(link -> {
            assertThat(link.leg()).isEqualTo(CarpoolLegKind.TO);
            assertThat(link.otherTitle()).isEqualTo("Squirt Practice");
            assertThat(link.combined()).isTrue();
        });
        assertThat(result.get(1).driveBlockLinks()).singleElement().satisfies(link -> {
            assertThat(link.leg()).isEqualTo(CarpoolLegKind.TO);
            assertThat(link.otherTitle()).isEqualTo("Mite Practice");
            assertThat(link.otherStartsAt()).isEqualTo(start1);
        });
    }

    @Test
    void surfacesForceSplitOverrideOnAdjacentPair() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        CalendarItemResponse a = feedItem(item1, "Practice A", start1, end1);
        CalendarItemResponse b =
                feedItem(item2, "Practice B", end1, end1.plusSeconds(3600));

        when(carpoolApi.listConfirmedDrivingLegs(eq(adultId), eq(circleId), any()))
                .thenReturn(
                        List.of(
                                new CarpoolConfirmedDrivingLegDto(item1, CarpoolLegKind.TO),
                                new CarpoolConfirmedDrivingLegDto(item2, CarpoolLegKind.TO)));
        when(leaveByApi.cheapVenueDrives(eq(adultId), any()))
                .thenReturn(
                        List.of(
                                new LeaveByVenueDriveDto(rink, 600),
                                new LeaveByVenueDriveDto(rink, 600)));
        when(leaveByApi.arrivalBufferMinutes(any())).thenReturn(20);
        when(overrideService.pairOverridesForAdult(adultId))
                .thenReturn(
                        List.of(
                                new DrivingBlockComputer.PairOverride(
                                        CarpoolLegKind.TO,
                                        CalendarItemSource.FEED,
                                        item1,
                                        CalendarItemSource.FEED,
                                        item2,
                                        DriveBlockOverrideAction.FORCE_SPLIT)));

        List<CalendarItemResponse> result = enricher.attach(adultId, circleId, List.of(a, b));

        CalendarDriveBlockLinkResponse link = result.get(0).driveBlockLinks().getFirst();
        assertThat(link.combined()).isFalse();
        assertThat(link.overrideAction()).isEqualTo(DriveBlockOverrideAction.FORCE_SPLIT);
    }

    @Test
    void doesNotCallHttpLeaveByPaths() {
        CalendarItemResponse a = feedItem(item1, "Practice", Instant.parse("2026-09-15T17:00:00Z"));
        when(carpoolApi.listConfirmedDrivingLegs(adultId, circleId, List.of(item1)))
                .thenReturn(List.of(new CarpoolConfirmedDrivingLegDto(item1, CarpoolLegKind.TO)));
        when(leaveByApi.cheapVenueDrives(eq(adultId), any()))
                .thenReturn(List.of(LeaveByVenueDriveDto.unavailable()));
        when(leaveByApi.arrivalBufferMinutes(any())).thenReturn(20);
        when(overrideService.pairOverridesForAdult(adultId)).thenReturn(List.of());

        enricher.attach(adultId, circleId, List.of(a));

        verify(leaveByApi).cheapVenueDrives(eq(adultId), any());
        verify(leaveByApi).arrivalBufferMinutes("Practice");
    }

    private static CalendarItemResponse feedItem(UUID id, String title, Instant startsAt) {
        return feedItem(id, title, startsAt, startsAt.plusSeconds(3600));
    }

    private static CalendarItemResponse feedItem(
            UUID id, String title, Instant startsAt, Instant endsAt) {
        return new CalendarItemResponse(
                id,
                CalendarItemSource.FEED,
                title,
                startsAt,
                endsAt,
                "Simoni Rink",
                List.of(),
                UUID.randomUUID(),
                "U12",
                "UID:" + id,
                null,
                null,
                null,
                null,
                LeaveByStatus.PENDING,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of());
    }
}
