package com.yourorg.quickapp.leaveby;

import java.util.UUID;

/** Explicit itinerary home-side override when present (Default = both null). */
public record ItineraryHomeSideDto(UUID leaveFromPlaceId, String leaveFromAddress) {

    public boolean isDefault() {
        return leaveFromPlaceId == null
                && (leaveFromAddress == null || leaveFromAddress.isBlank());
    }
}
