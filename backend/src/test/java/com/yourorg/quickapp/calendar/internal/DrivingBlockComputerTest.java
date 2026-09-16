package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.calendar.internal.DrivingBlockComputer.DriveBlock;
import com.yourorg.quickapp.calendar.internal.DrivingBlockComputer.EligibleItem;
import com.yourorg.quickapp.calendar.internal.DrivingBlockComputer.ItemRef;
import com.yourorg.quickapp.calendar.internal.DrivingBlockComputer.PairOverride;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DrivingBlockComputerTest {

    private static final String RINK_A = DrivingBlockComputer.venueIdentity(42.373600, -71.109700);
    private static final String RINK_B = DrivingBlockComputer.venueIdentity(42.380000, -71.120000);

    private final UUID item1 = UUID.randomUUID();
    private final UUID item2 = UUID.randomUUID();
    private final UUID item3 = UUID.randomUUID();

    @Test
    void venueIdentityRoundsToSixDecimals() {
        assertThat(DrivingBlockComputer.venueIdentity(42.37361234, -71.10971234))
                .isEqualTo("42.373612,-71.109712");
        assertThat(DrivingBlockComputer.venueIdentity(null, -71.1)).isNull();
        assertThat(DrivingBlockComputer.venueIdentity(42.3, null)).isNull();
    }

    @Test
    void sameVenueBackToBackZeroGapMergesIntoOneToBlock() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1; // 0-min raw gap
        Instant end2 = Instant.parse("2026-09-15T19:00:00Z");

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 600, 20),
                                item(item2, CarpoolLegKind.TO, start2, end2, RINK_A, 600, 20)),
                        List.of());

        assertThat(blocks).hasSize(1);
        assertThat(blocks.getFirst().leg()).isEqualTo(CarpoolLegKind.TO);
        assertThat(blocks.getFirst().items())
                .containsExactly(ref(item1), ref(item2));
    }

    @Test
    void onlyViewerEligibleItemsAreGrouped_otherDriverExcludedFromInput() {
        // Caller filters to the viewing adult; another adult's confirmed pickup
        // never appears in the input and therefore cannot merge.
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 600, 20)),
                        List.of());

        assertThat(blocks).singleElement().satisfies(block -> {
            assertThat(block.items()).containsExactly(ref(item1));
        });
    }

    @Test
    void sameDriverDifferentLegsStaySeparateBlocks() {
        Instant start = Instant.parse("2026-09-15T17:00:00Z");
        Instant end = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = Instant.parse("2026-09-15T18:00:00Z");
        Instant end2 = Instant.parse("2026-09-15T19:00:00Z");

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start, end, RINK_A, 600, 20),
                                item(item2, CarpoolLegKind.FROM, start2, end2, RINK_A, 600, 0)),
                        List.of());

        assertThat(blocks).hasSize(2);
        assertThat(blocks.stream().map(DriveBlock::leg).toList())
                .containsExactlyInAnyOrder(CarpoolLegKind.TO, CarpoolLegKind.FROM);
    }

    @Test
    void shortDriveLongGapWithPracticePaddingSplits() {
        // 5 min one-way, 90-min raw gap, 20-min practice padding → effective ~70
        // vs round-trip 10 + 15 buffer = 25 → two blocks
        Instant start1 = Instant.parse("2026-09-15T16:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant start2 = end1.plus(90, ChronoUnit.MINUTES);
        Instant end2 = start2.plus(1, ChronoUnit.HOURS);

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 5 * 60, 0),
                                item(item2, CarpoolLegKind.TO, start2, end2, RINK_A, 5 * 60, 20)),
                        List.of());

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).items()).containsExactly(ref(item1));
        assertThat(blocks.get(1).items()).containsExactly(ref(item2));
    }

    @Test
    void longDriveShortGapWithGamePaddingMergesDespiteFlatThirtyWouldSplit() {
        // 25 min one-way, 30-min raw gap, 45-min game padding → effective -15
        // vs round-trip 50 + 15 = 65 → one block (flat 30-min raw rule would split)
        Instant start1 = Instant.parse("2026-09-15T16:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant start2 = end1.plus(30, ChronoUnit.MINUTES);
        Instant end2 = start2.plus(1, ChronoUnit.HOURS);

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 25 * 60, 0),
                                item(item2, CarpoolLegKind.TO, start2, end2, RINK_A, 25 * 60, 45)),
                        List.of());

        assertThat(blocks).singleElement().satisfies(block -> {
            assertThat(block.items()).containsExactly(ref(item1), ref(item2));
        });
        // Sanity: flat raw-gap alone would not merge at exactly 30 minutes
        assertThat(
                        DrivingBlockComputer.shouldAutoMerge(
                                item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, null, 0),
                                item(item2, CarpoolLegKind.TO, start2, end2, RINK_A, null, 45)))
                .isFalse();
    }

    @Test
    void differentVenueIdentityNeverAutoMerges() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1; // adjacent times
        Instant end2 = Instant.parse("2026-09-15T19:00:00Z");

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 600, 20),
                                item(item2, CarpoolLegKind.TO, start2, end2, RINK_B, 600, 20)),
                        List.of());

        assertThat(blocks).hasSize(2);
    }

    @Test
    void nullVenueIdentityNeverAutoMergesEvenWhenBothNull() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1;

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start1, end1, null, 600, 20),
                                item(item2, CarpoolLegKind.TO, start2, start2.plusSeconds(3600), null, 600, 20)),
                        List.of());

        assertThat(blocks).hasSize(2);
    }

    @Test
    void unavailableDriveTimeUsesThirtyMinuteMergeBiasedFallback() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");

        EligibleItem a = item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, null, 0);
        EligibleItem mergeable =
                item(
                        item2,
                        CarpoolLegKind.TO,
                        end1.plus(29, ChronoUnit.MINUTES),
                        end1.plus(90, ChronoUnit.MINUTES),
                        RINK_A,
                        null,
                        0);
        EligibleItem tooFar =
                item(
                        item3,
                        CarpoolLegKind.TO,
                        end1.plus(30, ChronoUnit.MINUTES),
                        end1.plus(90, ChronoUnit.MINUTES),
                        RINK_A,
                        null,
                        0);

        assertThat(DrivingBlockComputer.shouldAutoMerge(a, mergeable)).isTrue();
        assertThat(DrivingBlockComputer.shouldAutoMerge(a, tooFar)).isFalse();

        assertThat(DrivingBlockComputer.compute(List.of(a, mergeable), List.of()))
                .singleElement()
                .satisfies(block -> assertThat(block.items()).hasSize(2));
        assertThat(DrivingBlockComputer.compute(List.of(a, tooFar), List.of())).hasSize(2);
    }

    @Test
    void missingEndsAtUsesThirtyMinuteFallbackWithoutInventingDuration() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        // null endsAt → zero-length at startsAt for raw gap only; still fallback path
        EligibleItem a = item(item1, CarpoolLegKind.TO, start1, null, RINK_A, 600, 0);
        EligibleItem close =
                item(
                        item2,
                        CarpoolLegKind.TO,
                        start1.plus(20, ChronoUnit.MINUTES),
                        start1.plus(80, ChronoUnit.MINUTES),
                        RINK_A,
                        600,
                        20);
        EligibleItem far =
                item(
                        item3,
                        CarpoolLegKind.TO,
                        start1.plus(40, ChronoUnit.MINUTES),
                        start1.plus(100, ChronoUnit.MINUTES),
                        RINK_A,
                        600,
                        20);

        assertThat(DrivingBlockComputer.shouldAutoMerge(a, close)).isTrue();
        assertThat(DrivingBlockComputer.shouldAutoMerge(a, far)).isFalse();
    }

    @Test
    void forceMergeOverridesAutoSplit() {
        Instant start1 = Instant.parse("2026-09-15T16:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant start2 = end1.plus(90, ChronoUnit.MINUTES);
        Instant end2 = start2.plus(1, ChronoUnit.HOURS);

        EligibleItem a = item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 5 * 60, 0);
        EligibleItem b = item(item2, CarpoolLegKind.TO, start2, end2, RINK_A, 5 * 60, 20);

        assertThat(DrivingBlockComputer.compute(List.of(a, b), List.of())).hasSize(2);

        List<DriveBlock> forced =
                DrivingBlockComputer.compute(
                        List.of(a, b),
                        List.of(
                                new PairOverride(
                                        CarpoolLegKind.TO,
                                        CalendarItemSource.FEED,
                                        item1,
                                        CalendarItemSource.FEED,
                                        item2,
                                        DriveBlockOverrideAction.FORCE_MERGE)));

        assertThat(forced).singleElement().satisfies(block -> {
            assertThat(block.items()).containsExactly(ref(item1), ref(item2));
        });
    }

    @Test
    void forceSplitOverridesAutoMerge() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1;
        Instant end2 = Instant.parse("2026-09-15T19:00:00Z");

        EligibleItem a = item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 600, 20);
        EligibleItem b = item(item2, CarpoolLegKind.TO, start2, end2, RINK_A, 600, 20);

        assertThat(DrivingBlockComputer.compute(List.of(a, b), List.of())).hasSize(1);

        List<DriveBlock> split =
                DrivingBlockComputer.compute(
                        List.of(a, b),
                        List.of(
                                new PairOverride(
                                        CarpoolLegKind.TO,
                                        CalendarItemSource.FEED,
                                        item1,
                                        CalendarItemSource.FEED,
                                        item2,
                                        DriveBlockOverrideAction.FORCE_SPLIT)));

        assertThat(split).hasSize(2);
    }

    @Test
    void forceMergeCanCombineDifferentVenues() {
        Instant start1 = Instant.parse("2026-09-15T17:00:00Z");
        Instant end1 = Instant.parse("2026-09-15T18:00:00Z");
        Instant start2 = end1;
        Instant end2 = Instant.parse("2026-09-15T19:00:00Z");

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, start1, end1, RINK_A, 600, 20),
                                item(item2, CarpoolLegKind.TO, start2, end2, RINK_B, 600, 20)),
                        List.of(
                                new PairOverride(
                                        CarpoolLegKind.TO,
                                        CalendarItemSource.FEED,
                                        item1,
                                        CalendarItemSource.FEED,
                                        item2,
                                        DriveBlockOverrideAction.FORCE_MERGE)));

        assertThat(blocks).singleElement().satisfies(block -> {
            assertThat(block.items()).containsExactly(ref(item1), ref(item2));
        });
    }

    @Test
    void singletonWhenOnlyOneEligibleItem() {
        Instant start = Instant.parse("2026-09-15T17:00:00Z");
        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(
                                        item1,
                                        CarpoolLegKind.FROM,
                                        start,
                                        start.plus(1, ChronoUnit.HOURS),
                                        RINK_A,
                                        600,
                                        0)),
                        List.of());

        assertThat(blocks).singleElement().satisfies(block -> {
            assertThat(block.leg()).isEqualTo(CarpoolLegKind.FROM);
            assertThat(block.items()).containsExactly(ref(item1));
        });
    }

    @Test
    void threeItemsChainsMergesIntoOneBlock() {
        Instant t0 = Instant.parse("2026-09-15T16:00:00Z");
        Instant t1 = t0.plus(1, ChronoUnit.HOURS);
        Instant t2 = t1.plus(1, ChronoUnit.HOURS);
        Instant t3 = t2.plus(1, ChronoUnit.HOURS);

        List<DriveBlock> blocks =
                DrivingBlockComputer.compute(
                        List.of(
                                item(item1, CarpoolLegKind.TO, t0, t1, RINK_A, 600, 20),
                                item(item2, CarpoolLegKind.TO, t1, t2, RINK_A, 600, 20),
                                item(item3, CarpoolLegKind.TO, t2, t3, RINK_A, 600, 20)),
                        List.of());

        assertThat(blocks).singleElement().satisfies(block -> {
            assertThat(block.items()).containsExactly(ref(item1), ref(item2), ref(item3));
        });
    }

    private static EligibleItem item(
            UUID id,
            CarpoolLegKind leg,
            Instant startsAt,
            Instant endsAt,
            String venueIdentity,
            Integer oneWayDriveSeconds,
            int paddingMinutes) {
        return new EligibleItem(
                id,
                CalendarItemSource.FEED,
                leg,
                startsAt,
                endsAt,
                venueIdentity,
                oneWayDriveSeconds,
                paddingMinutes);
    }

    private static ItemRef ref(UUID id) {
        return new ItemRef(CalendarItemSource.FEED, id);
    }
}
