package com.yourorg.quickapp.carpool;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Public carpool surface for other Modulith modules (e.g. calendar) without
 * touching carpool internals.
 */
public interface CarpoolApi {

    /**
     * Withdraw every ACCEPTED inbound ride for this feed event where the
     * caller's circle is the accepting circle. No-op when the event is missing
     * or the circle has no carpool space memberships. Does not change
     * attendance.
     */
    void withdrawAcceptedInboundForFeedEvent(UUID actorAdultId, UUID feedEventId);

    /**
     * When a kid is marked not going ({@code RSVP NO}) on a feed event: remove
     * them from this circle's active ride plans for that event. Clears pending
     * asks and confirmed fulfillments for that kid. If no kids remain on a
     * plan, cancels the whole plan (both legs). No-op when the event is
     * missing, the circle has no space membership, or the kid is not on an
     * active plan.
     */
    void clearTransportForNotGoingKid(UUID actorAdultId, UUID feedEventId, UUID kidId);

    /**
     * Accepted teammate family-side stops for Route middles on the given leg
     * (TO pickup / FROM drop-off). Meet-at-requester only. Empty when the event
     * is missing or the circle has no space membership.
     */
    List<CarpoolAcceptedPickupDto> listAcceptedFamilyStopsForFeedEvent(
            UUID circleId, UUID feedEventId, CarpoolLegKind leg);

    /**
     * Accepted teammate TO pickups visible for multi-stop route building.
     */
    default List<CarpoolAcceptedPickupDto> listAcceptedPickupsForFeedEvent(
            UUID circleId, UUID feedEventId) {
        return listAcceptedFamilyStopsForFeedEvent(circleId, feedEventId, CarpoolLegKind.TO);
    }

    /**
     * CONFIRMED TO/FROM legs where {@code adultId} is the assignee, for the
     * given feed events in spaces (or circle-local plans) this adult's circle
     * can see. Pending asks do not qualify. Dedupes to one row per
     * (feedEventId, leg).
     */
    List<CarpoolConfirmedDrivingLegDto> listConfirmedDrivingLegs(
            UUID adultId, UUID circleId, Collection<UUID> feedEventIds);

    /**
     * Family-side places on CONFIRMED legs assigned to {@code adultId} for one
     * feed event (own household / PLAN rows). Used for combined-block Route
     * middles when the driver set picking-up / dropping-off on Save ride plan.
     * Empty when the event is missing or there is no confirmed leg place.
     */
    List<CarpoolHouseholdStopDto> listConfirmedHouseholdStopsForFeedEvent(
            UUID adultId, UUID circleId, UUID feedEventId, CarpoolLegKind leg);

    /**
     * Active own-circle ride plans for a FEED event (space-backed or
     * circle-local). Empty when the event is missing or there are no active
     * plans.
     */
    List<CarpoolRideResponse> listActiveOwnPlansForFeedEvent(UUID circleId, UUID feedEventId);

    /**
     * Save-shaped standing Lock snapshots for active own plans on a FEED event
     * ({@code placeId} XOR one-time address). Empty when missing / no plans.
     */
    List<CarpoolStandingPlanGroupDto> listStandingPlanSnapshotsForFeedEvent(
            UUID circleId, UUID feedEventId);

    /**
     * Cancel every active own-circle ride plan for a FEED event (PENDING /
     * ACCEPTED / PLAN). Used when Remove recurring clears applied weeks.
     * No-op when the event is missing or there are no active plans.
     */
    void cancelActiveOwnPlansForFeedEvent(UUID circleId, UUID feedEventId);

    /** True when {@link #listActiveOwnPlansForFeedEvent} is non-empty. */
    boolean hasActiveOwnPlansForFeedEvent(UUID circleId, UUID feedEventId);

    /**
     * Household-only Save ride plan for a FEED event (rejects Ask-the-team).
     * Uses the event's carpool space when the circle is a member; otherwise
     * circle-local null-space plans.
     */
    SaveCarpoolRidePlanResponse saveHouseholdPlanForFeedEvent(
            com.yourorg.quickapp.auth.AdultResponse adult,
            UUID feedEventId,
            java.util.List<SaveCarpoolRidePlanGroup> plans);

    /**
     * Confirms WAITING_HOUSEHOLD legs assigned to {@code adult} on the FEED
     * event's active own plans (space or circle-local). No-op conflict when
     * nothing is waiting for them.
     */
    SaveCarpoolRidePlanResponse confirmHouseholdPlanForFeedEvent(
            com.yourorg.quickapp.auth.AdultResponse adult, UUID feedEventId);

    /**
     * Standing apply: attempt confirm in a nested transaction. Returns false on
     * CONFLICT (already confirmed / nothing waiting) without poisoning the
     * caller's transaction.
     */
    boolean tryConfirmHouseholdPlanForFeedEvent(
            com.yourorg.quickapp.auth.AdultResponse adult, UUID feedEventId);
}
