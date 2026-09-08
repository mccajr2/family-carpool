package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Coverage assignment on a calendar Agenda row (circle-visible leave-from). */
public record CalendarCoverageAssignmentResponse(
        UUID id,
        UUID coveringAdultId,
        String coveringAdultDisplayName,
        UUID assignedByAdultId,
        List<UUID> kidIds,
        CoverageStatus status,
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        String leaveFromAddress,
        Instant leaveByAt,
        LeaveByStatus leaveByStatus,
        String leaveByReason) {}
