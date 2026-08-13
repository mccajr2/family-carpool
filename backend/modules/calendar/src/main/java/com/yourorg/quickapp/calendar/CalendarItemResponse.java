package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.LeaveByStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CalendarItemResponse(
        UUID id,
        CalendarItemSource source,
        String title,
        Instant startsAt,
        Instant endsAt,
        String location,
        List<UUID> kidIds,
        UUID feedId,
        String feedName,
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        Instant leaveByAt,
        LeaveByStatus leaveByStatus,
        String leaveByReason,
        List<CalendarCoverageAssignmentResponse> coverages,
        List<UUID> uncoveredKidIds,
        List<CalendarConflictResponse> conflicts) {}
