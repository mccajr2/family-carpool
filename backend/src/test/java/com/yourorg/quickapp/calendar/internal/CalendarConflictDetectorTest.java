package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.calendar.CalendarConflictResponse;
import com.yourorg.quickapp.calendar.CalendarConflictType;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CalendarConflictDetectorTest {

    private final UUID kidA = UUID.randomUUID();
    private final UUID kidB = UUID.randomUUID();
    private final UUID adult = UUID.randomUUID();
    private final UUID item1 = UUID.randomUUID();
    private final UUID item2 = UUID.randomUUID();

    @Test
    void kidOverlapMarksBothItems() {
        var a =
                item(
                        item1,
                        "Practice",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        List.of(kidA),
                        List.of());
        var b =
                item(
                        item2,
                        "Game",
                        Instant.parse("2026-08-15T17:30:00Z"),
                        Instant.parse("2026-08-15T19:00:00Z"),
                        List.of(kidA, kidB),
                        List.of());

        Map<CalendarConflictDetector.ItemKey, List<CalendarConflictResponse>> result =
                CalendarConflictDetector.detect(List.of(a, b), Map.of());

        assertThat(result.get(key(item1)))
                .singleElement()
                .satisfies(
                        c -> {
                            assertThat(c.type()).isEqualTo(CalendarConflictType.KID_TIME_OVERLAP);
                            assertThat(c.kidId()).isEqualTo(kidA);
                            assertThat(c.otherItemId()).isEqualTo(item2);
                            assertThat(c.otherTitle()).isEqualTo("Game");
                        });
        assertThat(result.get(key(item2)))
                .singleElement()
                .satisfies(c -> assertThat(c.otherItemId()).isEqualTo(item1));
    }

    @Test
    void pendingPlusConfirmedAdultOverlapIsAmber() {
        var a =
                item(
                        item1,
                        "A",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        List.of(kidA),
                        List.of(new CalendarConflictDetector.ActiveCoverage(
                                adult, CoverageStatus.CONFIRMED)));
        var b =
                item(
                        item2,
                        "B",
                        Instant.parse("2026-08-15T17:30:00Z"),
                        Instant.parse("2026-08-15T18:30:00Z"),
                        List.of(kidB),
                        List.of(new CalendarConflictDetector.ActiveCoverage(
                                adult, CoverageStatus.PENDING)));

        Map<CalendarConflictDetector.ItemKey, List<CalendarConflictResponse>> result =
                CalendarConflictDetector.detect(List.of(a, b), Map.of(adult, "Alex"));

        assertThat(result.get(key(item1)))
                .singleElement()
                .satisfies(
                        c -> {
                            assertThat(c.type())
                                    .isEqualTo(CalendarConflictType.ADULT_COVERAGE_OVERLAP);
                            assertThat(c.adultId()).isEqualTo(adult);
                            assertThat(c.adultDisplayName()).isEqualTo("Alex");
                        });
    }

    @Test
    void pendingPlusPendingAdultOverlapIsAmber() {
        var a =
                item(
                        item1,
                        "A",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        List.of(kidA),
                        List.of(new CalendarConflictDetector.ActiveCoverage(
                                adult, CoverageStatus.PENDING)));
        var b =
                item(
                        item2,
                        "B",
                        Instant.parse("2026-08-15T17:30:00Z"),
                        Instant.parse("2026-08-15T18:30:00Z"),
                        List.of(kidB),
                        List.of(new CalendarConflictDetector.ActiveCoverage(
                                adult, CoverageStatus.PENDING)));

        assertThat(CalendarConflictDetector.detect(List.of(a, b), Map.of()))
                .containsKeys(key(item1), key(item2));
    }

    @Test
    void declinedCoverageDoesNotCreateAdultConflict() {
        var a =
                item(
                        item1,
                        "A",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        List.of(kidA),
                        List.of(new CalendarConflictDetector.ActiveCoverage(
                                adult, CoverageStatus.CONFIRMED)));
        // DECLINED is filtered before detect — empty active list on B
        var b =
                item(
                        item2,
                        "B",
                        Instant.parse("2026-08-15T17:30:00Z"),
                        Instant.parse("2026-08-15T18:30:00Z"),
                        List.of(kidB),
                        List.of());

        assertThat(CalendarConflictDetector.detect(List.of(a, b), Map.of())).isEmpty();
    }

    @Test
    void nonOverlappingItemsHaveNoConflicts() {
        var a =
                item(
                        item1,
                        "A",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        List.of(kidA),
                        List.of());
        var b =
                item(
                        item2,
                        "B",
                        Instant.parse("2026-08-15T18:00:00Z"),
                        Instant.parse("2026-08-15T19:00:00Z"),
                        List.of(kidA),
                        List.of());

        assertThat(CalendarConflictDetector.detect(List.of(a, b), Map.of())).isEmpty();
    }

    private static CalendarConflictDetector.ItemKey key(UUID id) {
        return new CalendarConflictDetector.ItemKey(CalendarItemSource.MANUAL, id);
    }

    private static CalendarConflictDetector.ScheduleItem item(
            UUID id,
            String title,
            Instant startsAt,
            Instant endsAt,
            List<UUID> kidIds,
            List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                id, CalendarItemSource.MANUAL, title, startsAt, endsAt, kidIds, coverages);
    }
}
