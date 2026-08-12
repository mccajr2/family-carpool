package com.yourorg.quickapp.family;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Public place lookup for other Modulith modules (e.g. leaveby) without
 * touching family internals.
 */
public interface FamilyPlaceApi {

    /**
     * Place owned by the adult's circle, if present.
     *
     * @throws FamilyAccessException 404 if the adult has no circle
     */
    Optional<CirclePlaceDto> findPlaceForMember(UUID adultId, UUID placeId);

    /**
     * Located places in the adult's circle, ordered by name (case-insensitive).
     * Used as the default leave-from candidate list.
     *
     * @throws FamilyAccessException 404 if the adult has no circle
     */
    List<CirclePlaceDto> listLocatedPlacesForMember(UUID adultId);

    /**
     * Located place in the adult's circle.
     *
     * @throws FamilyAccessException 404 if no circle / unknown place; 400 if not located
     */
    CirclePlaceDto requireLocatedPlaceForMember(UUID adultId, UUID placeId);

    /**
     * The adult's default leave-from place when set and still located; empty if
     * unset, missing, or not located.
     *
     * @throws FamilyAccessException 404 if the adult has no circle
     */
    Optional<CirclePlaceDto> findDefaultLeaveFromForMember(UUID adultId);
}
