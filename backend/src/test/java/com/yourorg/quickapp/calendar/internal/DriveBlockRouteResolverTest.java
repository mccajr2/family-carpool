package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.internal.DrivingBlockComputer.DriveBlock;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByVenueDriveDto;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DriveBlockRouteResolverTest {

    private static final String VENUE = DrivingBlockComputer.venueIdentity(42.373600, -71.109700);

    @Mock
    private CarpoolApi carpoolApi;

    @Mock
    private LeaveByApi leaveByApi;

    @Mock
    private DriveBlockOverrideService overrideService;

    private DriveBlockRouteResolver resolver;

    private final UUID adultId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID itemA = UUID.randomUUID();
    private final UUID itemB = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        resolver = new DriveBlockRouteResolver(carpoolApi, leaveByApi, overrideService);
        lenient().when(overrideService.pairOverridesForAdult(adultId)).thenReturn(List.of());
    }

    @Test
    void resolveReturnsCombinedToBlockForAdjacentSameVenueEvents() {
        Instant startA = Instant.parse("2026-08-15T17:00:00Z");
        Instant endA = Instant.parse("2026-08-15T18:00:00Z");
        Instant startB = endA;
        Instant endB = Instant.parse("2026-08-15T19:00:00Z");
        List<CalendarItemResponse> feedItems =
                List.of(feedItem(itemA, "Practice A", startA, endA), feedItem(itemB, "Practice B", startB, endB));

        when(carpoolApi.listConfirmedDrivingLegs(eq(adultId), eq(circleId), any()))
                .thenReturn(
                        List.of(
                                new CarpoolConfirmedDrivingLegDto(itemA, CarpoolLegKind.TO),
                                new CarpoolConfirmedDrivingLegDto(itemB, CarpoolLegKind.TO)));
        when(leaveByApi.cheapVenueDrives(eq(adultId), any()))
                .thenReturn(
                        List.of(
                                new LeaveByVenueDriveDto(VENUE, 600),
                                new LeaveByVenueDriveDto(VENUE, 600)));
        when(leaveByApi.arrivalBufferMinutes(any())).thenReturn(20);

        Optional<DriveBlock> block =
                resolver.resolve(
                        adultId,
                        circleId,
                        CalendarItemSource.FEED,
                        itemB,
                        CarpoolLegKind.TO,
                        feedItems);

        assertThat(block).isPresent();
        assertThat(block.get().leg()).isEqualTo(CarpoolLegKind.TO);
        assertThat(block.get().items())
                .extracting(DrivingBlockComputer.ItemRef::id)
                .containsExactly(itemA, itemB);
    }

    @Test
    void resolveEmptyWhenAdultNotDrivingRequestedLeg() {
        Instant start = Instant.parse("2026-08-15T17:00:00Z");
        List<CalendarItemResponse> feedItems =
                List.of(feedItem(itemA, "Practice A", start, start.plusSeconds(3600)));

        when(carpoolApi.listConfirmedDrivingLegs(eq(adultId), eq(circleId), any()))
                .thenReturn(List.of(new CarpoolConfirmedDrivingLegDto(itemA, CarpoolLegKind.TO)));

        Optional<DriveBlock> block =
                resolver.resolve(
                        adultId,
                        circleId,
                        CalendarItemSource.FEED,
                        itemA,
                        CarpoolLegKind.FROM,
                        feedItems);

        assertThat(block).isEmpty();
    }

    @Test
    void resolveManualIsSingleton() {
        Optional<DriveBlock> block =
                resolver.resolve(
                        adultId,
                        circleId,
                        CalendarItemSource.MANUAL,
                        itemA,
                        CarpoolLegKind.TO,
                        List.of());

        assertThat(block).isPresent();
        assertThat(block.get().items())
                .containsExactly(new DrivingBlockComputer.ItemRef(CalendarItemSource.MANUAL, itemA));
    }

    private static CalendarItemResponse feedItem(
            UUID id, String title, Instant startsAt, Instant endsAt) {
        return new CalendarItemResponse(
                id,
                CalendarItemSource.FEED,
                title,
                startsAt,
                endsAt,
                "Field 3",
                List.of(UUID.randomUUID()),
                UUID.randomUUID(),
                "U12",
                "UID:" + id,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of());
    }
}
