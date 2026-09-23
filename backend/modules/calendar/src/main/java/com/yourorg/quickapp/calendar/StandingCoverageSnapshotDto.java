package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.coverage.CoverageStatus;
import java.util.List;
import java.util.UUID;

/** Active coverage row on a locked member item (PENDING / CONFIRMED). */
public record StandingCoverageSnapshotDto(
        UUID coveringAdultId,
        UUID assignedByAdultId,
        CoverageStatus status,
        List<UUID> kidIds,
        UUID leaveFromPlaceId,
        String leaveFromAddress) {}
