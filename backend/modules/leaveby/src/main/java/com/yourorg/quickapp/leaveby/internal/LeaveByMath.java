package com.yourorg.quickapp.leaveby.internal;

import java.time.Instant;
import java.time.ZoneOffset;

/** Pure leave-by math: travel × TOD multiplier + fixed buffer. */
final class LeaveByMath {

    private LeaveByMath() {}

    static double timeOfDayMultiplier(Instant startsAt, LeaveByProperties props) {
        int hour = startsAt.atZone(ZoneOffset.UTC).getHour();
        if (inHalfOpenRange(hour, props.morningPeakStartHourUtc(), props.morningPeakEndHourUtc())
                || inHalfOpenRange(
                        hour, props.eveningPeakStartHourUtc(), props.eveningPeakEndHourUtc())) {
            return props.peakMultiplier();
        }
        return props.offPeakMultiplier();
    }

    static Instant leaveByAt(
            Instant startsAt, double travelSeconds, double multiplier, int fixedBufferSeconds) {
        long adjustedSeconds = Math.round(travelSeconds * multiplier) + fixedBufferSeconds;
        return startsAt.minusSeconds(Math.max(0, adjustedSeconds));
    }

    private static boolean inHalfOpenRange(int hour, int startInclusive, int endExclusive) {
        if (startInclusive <= endExclusive) {
            return hour >= startInclusive && hour < endExclusive;
        }
        // Wrap around midnight (not used by defaults, but safe).
        return hour >= startInclusive || hour < endExclusive;
    }
}
