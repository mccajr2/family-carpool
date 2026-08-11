package com.yourorg.quickapp.leaveby;

import java.time.Instant;
import java.util.UUID;

/** Leave-from + estimated leave-by for one calendar item and adult. */
public record LeaveByEnrichmentDto(
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        Instant leaveByAt,
        LeaveByStatus leaveByStatus,
        String leaveByReason) {

    public static LeaveByEnrichmentDto unavailable(
            UUID leaveFromPlaceId, String leaveFromPlaceName, String reason) {
        return new LeaveByEnrichmentDto(
                leaveFromPlaceId, leaveFromPlaceName, null, LeaveByStatus.UNAVAILABLE, reason);
    }

    public static LeaveByEnrichmentDto ok(
            UUID leaveFromPlaceId, String leaveFromPlaceName, Instant leaveByAt) {
        return new LeaveByEnrichmentDto(
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, LeaveByStatus.OK, null);
    }
}
