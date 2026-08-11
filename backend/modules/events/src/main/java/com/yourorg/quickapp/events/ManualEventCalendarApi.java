package com.yourorg.quickapp.events;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Member-safe calendar read of manual events in a time window. */
public interface ManualEventCalendarApi {

    List<ManualCalendarEventDto> listInRange(UUID circleId, Instant from, Instant to);

    /** Circle-scoped lookup for leave-from validation. */
    Optional<ManualCalendarEventDto> findInCircle(UUID circleId, UUID itemId);
}
