package com.yourorg.quickapp.family;

import java.util.Collection;
import java.util.UUID;

/**
 * Public family surface for other Modulith modules (e.g. feeds, events) to resolve
 * circle membership and validate kids without touching family internals.
 */
public interface FamilyMembershipApi {

    /**
     * @return circle id for an Organizer adult
     * @throws FamilyAccessException 404 if no circle; 403 if not Organizer
     */
    UUID requireOrganizerCircleId(UUID adultId);

    /**
     * @return circle id for any circle member (Organizer or Caregiver)
     * @throws FamilyAccessException 404 if no circle membership
     */
    UUID requireMemberCircleId(UUID adultId);

    /**
     * @throws FamilyAccessException 400 if any kid id is missing or not in the circle
     */
    void requireKidsInCircle(UUID circleId, Collection<UUID> kidIds);
}
