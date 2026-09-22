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
        List<UUID> kidIds,
        UUID feedId,
        String feedName) {

    /** Standalone (unlinked) manual — used by tests and callers that omit feed. */
    public ManualCalendarEventDto(
            UUID id,
            String title,
            Instant startsAt,
            Instant endsAt,
            String location,
            List<UUID> kidIds) {
        this(id, title, startsAt, endsAt, location, kidIds, null, null);
    }
}
