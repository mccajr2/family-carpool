package com.yourorg.quickapp.feeds;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record FeedCalendarEventDto(
        UUID id,
        UUID feedId,
        String feedName,
        String title,
        Instant startsAt,
        Instant endsAt,
        String location,
        List<UUID> kidIds) {}
