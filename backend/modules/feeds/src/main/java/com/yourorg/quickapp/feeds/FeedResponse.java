package com.yourorg.quickapp.feeds;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record FeedResponse(
        UUID id,
        String name,
        String sourceUrl,
        List<UUID> kidIds,
        Instant lastSyncedAt,
        String lastSyncError,
        int eventCount) {}
