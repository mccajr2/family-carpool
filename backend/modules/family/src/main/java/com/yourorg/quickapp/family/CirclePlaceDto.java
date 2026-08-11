package com.yourorg.quickapp.family;

import java.util.UUID;

/** Circle place visible to other modules (leave-by origins). */
public record CirclePlaceDto(
        UUID id,
        UUID circleId,
        String name,
        String address,
        Double latitude,
        Double longitude) {

    public boolean located() {
        return latitude != null && longitude != null;
    }
}
