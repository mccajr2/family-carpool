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
        /** Named-place override; mutually exclusive with {@code leaveFromAddress}. */
        UUID leaveFromPlaceId,
        /** One-time address override; mutually exclusive with {@code leaveFromPlaceId}. */
        String leaveFromAddress,
        Instant createdAt,
        Instant updatedAt) {}
