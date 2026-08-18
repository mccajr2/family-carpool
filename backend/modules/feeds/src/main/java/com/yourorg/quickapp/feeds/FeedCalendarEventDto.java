package com.yourorg.quickapp.feeds;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Synced feed event for calendar and carpool. {@code uid} is the iCal UID
 * when the VEVENT had one; null when the feed omitted UID.
 */
public record FeedCalendarEventDto(
        UUID id,
        UUID feedId,
        String feedName,
        String uid,
        String title,
        Instant startsAt,
        Instant endsAt,
        String location,
        List<UUID> kidIds) {}
