package com.yourorg.quickapp.family;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Public family surface for other Modulith modules (e.g. feeds, events, carpool)
 * to resolve circle membership and names without touching family internals.
 * Requester display name for “requested by {displayName}” is on
 * {@code AdultSessionApi.requireAdult}, not this API.
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
     * @return ORGANIZER or CAREGIVER for the adult's circle
     * @throws FamilyAccessException 404 if no circle membership
     */
    FamilyRole requireMemberRole(UUID adultId);

    /**
     * @throws FamilyAccessException 400 if any kid id is missing or not in the circle
     */
    void requireKidsInCircle(UUID circleId, Collection<UUID> kidIds);

    /**
     * @throws FamilyAccessException 404 if the adult is not a member of the circle
     */
    void requireAdultInCircle(UUID circleId, UUID adultId);

    /**
     * Circle name for member/request rendering. Empty when the circle does not
     * exist. {@link FamilyCircleName#name()} is null when unnamed.
     */
    Optional<FamilyCircleName> findCircle(UUID circleId);

    /**
     * Same as {@link #findCircle(UUID)} for many ids. Skips unknown ids.
     * Order follows {@code circleIds} (duplicates collapsed).
     */
    List<FamilyCircleName> findCircles(Collection<UUID> circleIds);
}
