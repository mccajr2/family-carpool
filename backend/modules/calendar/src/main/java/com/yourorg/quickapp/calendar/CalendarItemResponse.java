package com.yourorg.quickapp.calendar;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CalendarItemResponse(
        UUID id,
        CalendarItemSource source,
        String title,
        Instant startsAt,
        Instant endsAt,
        String location,
        List<UUID> kidIds,
        UUID feedId,
        String feedName) {}
