package com.yourorg.quickapp.coverage;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Coverage assignment visible to calendar / clients. */
public record CoverageAssignmentDto(
        UUID id,
        CoverageItemSource itemSource,
        UUID itemId,
        UUID coveringAdultId,
        UUID assignedByAdultId,
        List<UUID> kidIds,
        CoverageStatus status,
        Instant createdAt,
        Instant updatedAt) {}
