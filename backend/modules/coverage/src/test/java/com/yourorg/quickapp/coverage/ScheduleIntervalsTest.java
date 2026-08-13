package com.yourorg.quickapp.coverage;

import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleIntervalsTest {

    @Test
    void overlappingRangesConflict() {
        Instant aStart = Instant.parse("2026-08-15T17:00:00Z");
        Instant aEnd = Instant.parse("2026-08-15T18:00:00Z");
        Instant bStart = Instant.parse("2026-08-15T17:30:00Z");
        Instant bEnd = Instant.parse("2026-08-15T18:30:00Z");
        assertThat(ScheduleIntervals.overlaps(aStart, aEnd, bStart, bEnd)).isTrue();
    }

    @Test
    void adjacentRangesDoNotOverlap() {
        Instant aStart = Instant.parse("2026-08-15T17:00:00Z");
        Instant aEnd = Instant.parse("2026-08-15T18:00:00Z");
        Instant bStart = Instant.parse("2026-08-15T18:00:00Z");
        Instant bEnd = Instant.parse("2026-08-15T19:00:00Z");
        assertThat(ScheduleIntervals.overlaps(aStart, aEnd, bStart, bEnd)).isFalse();
    }

    @Test
    void nullEndsAtIsZeroLengthAtStart() {
        Instant t = Instant.parse("2026-08-15T17:00:00Z");
        Instant otherStart = Instant.parse("2026-08-15T16:00:00Z");
        Instant otherEnd = Instant.parse("2026-08-15T18:00:00Z");
        assertThat(ScheduleIntervals.overlaps(t, null, otherStart, otherEnd)).isTrue();
        assertThat(ScheduleIntervals.overlaps(t, null, t, null)).isFalse();
    }
}
