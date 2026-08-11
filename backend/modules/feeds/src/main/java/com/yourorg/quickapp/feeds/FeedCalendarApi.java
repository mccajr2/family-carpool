package com.yourorg.quickapp.feeds;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Member-safe calendar read of synced feed events (not Organizer-only feed manage).
 */
public interface FeedCalendarApi {

    List<FeedCalendarEventDto> listEventsInRange(UUID circleId, Instant from, Instant to);

    /** Circle-scoped lookup for leave-from validation (feed must belong to circle). */
    Optional<FeedCalendarEventDto> findEventInCircle(UUID circleId, UUID itemId);
}
