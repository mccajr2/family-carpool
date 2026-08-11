package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class LeaveByMathTest {

    private final LeaveByProperties props =
            new LeaveByProperties(300, 1800, 1.25, 1.0, 7, 9, 16, 19);

    @Test
    void offPeakUsesOffPeakMultiplier() {
        Instant startsAt = Instant.parse("2026-08-15T14:00:00Z"); // 14 UTC
        assertThat(LeaveByMath.timeOfDayMultiplier(startsAt, props)).isEqualTo(1.0);
    }

    @Test
    void morningPeakUsesPeakMultiplier() {
        Instant startsAt = Instant.parse("2026-08-15T08:00:00Z");
        assertThat(LeaveByMath.timeOfDayMultiplier(startsAt, props)).isEqualTo(1.25);
    }

    @Test
    void eveningPeakUsesPeakMultiplier() {
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        assertThat(LeaveByMath.timeOfDayMultiplier(startsAt, props)).isEqualTo(1.25);
    }

    @Test
    void leaveBySubtractsTravelTimesMultiplierPlusBuffer() {
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        // 1200 * 1.0 + 300 = 1500s = 25m
        Instant leaveBy = LeaveByMath.leaveByAt(startsAt, 1200, 1.0, 300);
        assertThat(leaveBy).isEqualTo(Instant.parse("2026-08-15T16:35:00Z"));
    }

    @Test
    void leaveByAppliesPeakMultiplier() {
        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        // 1200 * 1.25 + 300 = 1800s = 30m
        Instant leaveBy = LeaveByMath.leaveByAt(startsAt, 1200, 1.25, 300);
        assertThat(leaveBy).isEqualTo(Instant.parse("2026-08-15T16:30:00Z"));
    }
}
