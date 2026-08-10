package com.yourorg.quickapp.events;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ManualCalendarEventDto(
        UUID id,
        String title,
        Instant startsAt,
        Instant endsAt,
        String location,
        List<UUID> kidIds) {}
