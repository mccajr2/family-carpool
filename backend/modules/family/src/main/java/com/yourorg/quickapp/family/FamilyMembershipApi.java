package com.yourorg.quickapp.family;

import java.util.Collection;
import java.util.UUID;

/**
 * Public family surface for other Modulith modules (e.g. feeds) to resolve
 * organizer circle membership and validate kids without touching family internals.
 */
public interface FamilyMembershipApi {

    /**
     * @return circle id for an Organizer adult
     * @throws FamilyAccessException 404 if no circle; 403 if not Organizer
     */
    UUID requireOrganizerCircleId(UUID adultId);

    /**
     * @throws FamilyAccessException 400 if any kid id is missing or not in the circle
     */
    void requireKidsInCircle(UUID circleId, Collection<UUID> kidIds);
}
