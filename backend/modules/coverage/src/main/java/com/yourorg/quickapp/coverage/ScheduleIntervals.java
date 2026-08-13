package com.yourorg.quickapp.coverage;

import java.time.Instant;

/**
 * Shared event-window overlap for coverage double-book guards and calendar
 * conflict enrichment. Half-open {@code [startsAt, end)} where
 * {@code end = endsAt} if set, else {@code startsAt} (zero-length).
 */
public final class ScheduleIntervals {

    private ScheduleIntervals() {}

    public static Instant endExclusive(Instant startsAt, Instant endsAt) {
        return endsAt != null ? endsAt : startsAt;
    }

    public static boolean overlaps(
            Instant aStartsAt, Instant aEndsAt, Instant bStartsAt, Instant bEndsAt) {
        Instant aEnd = endExclusive(aStartsAt, aEndsAt);
        Instant bEnd = endExclusive(bStartsAt, bEndsAt);
        return aStartsAt.isBefore(bEnd) && bStartsAt.isBefore(aEnd);
    }
}
