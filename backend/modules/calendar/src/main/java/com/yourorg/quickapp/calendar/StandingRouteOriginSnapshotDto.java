package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.util.UUID;

/**
 * Per-adult itinerary home-side override for the member-set route (Leaving from
 * on TO / Returning to on FROM).
 */
public record StandingRouteOriginSnapshotDto(
        UUID adultId,
        CarpoolLegKind leg,
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        String leaveFromAddress) {}
