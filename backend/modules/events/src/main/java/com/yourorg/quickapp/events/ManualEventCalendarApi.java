package com.yourorg.quickapp.events;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Member-safe calendar read of manual events in a time window. */
public interface ManualEventCalendarApi {

    List<ManualCalendarEventDto> listInRange(UUID circleId, Instant from, Instant to);

    /**
     * Events whose {@code [startsAt, endsAt||startsAt)} overlaps
     * {@code [windowStart, windowEnd)}. Used for conflict peers outside an Agenda
     * startsAt page.
     */
    List<ManualCalendarEventDto> listOverlapping(
            UUID circleId, Instant windowStart, Instant windowEnd);

    /** Circle-scoped lookup for leave-from validation. */
    Optional<ManualCalendarEventDto> findInCircle(UUID circleId, UUID itemId);
}
