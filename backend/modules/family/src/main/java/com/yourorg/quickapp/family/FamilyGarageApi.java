package com.yourorg.quickapp.family;

import java.util.UUID;

/**
 * Public garage snapshot for other modules (e.g. carpool request/accept) without
 * touching family internals.
 */
public interface FamilyGarageApi {

    /**
     * Circle garage: each member's {@code drives} flag and all vehicles (owner +
     * who may drive).
     *
     * @throws FamilyAccessException 404 if the circle does not exist
     */
    GarageResponse garageForCircle(UUID circleId);
}
