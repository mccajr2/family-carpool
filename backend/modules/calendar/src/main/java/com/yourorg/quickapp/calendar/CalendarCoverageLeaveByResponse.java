package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.LeaveByStatus;
import java.time.Instant;
import java.util.UUID;

/** Coverage leave-from / leave-by patch on a fill-in row. */
public record CalendarCoverageLeaveByResponse(
        UUID id,
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        String leaveFromAddress,
        Instant leaveByAt,
        LeaveByStatus leaveByStatus,
        String leaveByReason) {}
