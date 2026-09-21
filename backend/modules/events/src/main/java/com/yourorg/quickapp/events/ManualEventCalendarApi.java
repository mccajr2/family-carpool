package com.yourorg.quickapp.events;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ManualEventCalendarApi {

    List<ManualCalendarEventDto> listInRange(UUID circleId, Instant from, Instant to);

    /**
     * Events whose {@code [startsAt, endsAt||startsAt)} overlaps
     * {@code [windowStart, windowEnd)}. Used for conflict peers outside an Agenda
     * startsAt page.
     */
    List<ManualCalendarEventDto> listOverlapping(
            UUID circleId, Instant windowStart, Instant windowEnd);

    /**
     * Manuals linked to {@code feedId} with {@code startsAt} in {@code [from, to)}.
     * Empty when the feed has none in range.
     */
    List<ManualCalendarEventDto> listLinkedToFeedInRange(
            UUID circleId, UUID feedId, Instant from, Instant to);

    /** Circle-scoped lookup for leave-from validation. */
    Optional<ManualCalendarEventDto> findInCircle(UUID circleId, UUID itemId);
}
