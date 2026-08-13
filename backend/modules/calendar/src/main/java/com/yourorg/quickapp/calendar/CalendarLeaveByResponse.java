package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.LeaveByStatus;
import java.time.Instant;
import java.util.UUID;

/** Leave-by fill-in row for one calendar item and the current adult. */
public record CalendarLeaveByResponse(
        UUID id,
        CalendarItemSource source,
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        Instant leaveByAt,
        LeaveByStatus leaveByStatus,
        String leaveByReason) {}
