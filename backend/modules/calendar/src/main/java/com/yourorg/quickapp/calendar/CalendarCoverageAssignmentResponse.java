package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.coverage.CoverageStatus;
import java.util.List;
import java.util.UUID;

/** Coverage assignment on a calendar Agenda row. */
public record CalendarCoverageAssignmentResponse(
        UUID id,
        UUID coveringAdultId,
        String coveringAdultDisplayName,
        UUID assignedByAdultId,
        List<UUID> kidIds,
        CoverageStatus status) {}
