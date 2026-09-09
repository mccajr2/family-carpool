package com.yourorg.quickapp.leaveby;

import java.time.Instant;
import java.util.UUID;

/** Leave-from + estimated leave-by for one calendar item and adult. */
public record LeaveByEnrichmentDto(
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        String leaveFromAddress,
        Instant leaveByAt,
        LeaveByStatus leaveByStatus,
        String leaveByReason) {

    public static LeaveByEnrichmentDto unavailable(
            UUID leaveFromPlaceId, String leaveFromPlaceName, String reason) {
        return unavailable(leaveFromPlaceId, leaveFromPlaceName, null, reason);
    }

    public static LeaveByEnrichmentDto unavailable(
            UUID leaveFromPlaceId,
            String leaveFromPlaceName,
            String leaveFromAddress,
            String reason) {
        return new LeaveByEnrichmentDto(
                leaveFromPlaceId,
                leaveFromPlaceName,
                leaveFromAddress,
                null,
                LeaveByStatus.UNAVAILABLE,
                reason);
    }

    public static LeaveByEnrichmentDto ok(
            UUID leaveFromPlaceId, String leaveFromPlaceName, Instant leaveByAt) {
        return ok(leaveFromPlaceId, leaveFromPlaceName, null, leaveByAt);
    }

    public static LeaveByEnrichmentDto ok(
            UUID leaveFromPlaceId,
            String leaveFromPlaceName,
            String leaveFromAddress,
            Instant leaveByAt) {
        return new LeaveByEnrichmentDto(
                leaveFromPlaceId,
                leaveFromPlaceName,
                leaveFromAddress,
                leaveByAt,
                LeaveByStatus.OK,
                null);
    }

    public static LeaveByEnrichmentDto pending(
            UUID leaveFromPlaceId, String leaveFromPlaceName) {
        return pending(leaveFromPlaceId, leaveFromPlaceName, null);
    }

    public static LeaveByEnrichmentDto pending(
            UUID leaveFromPlaceId, String leaveFromPlaceName, String leaveFromAddress) {
        return new LeaveByEnrichmentDto(
                leaveFromPlaceId,
                leaveFromPlaceName,
                leaveFromAddress,
                null,
                LeaveByStatus.PENDING,
                null);
    }
}
