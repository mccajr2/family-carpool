package com.yourorg.quickapp.carpool;

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
     * ACCEPTED rides on this feed event in spaces the circle belongs to (as
     * requester or acceptor). Empty when the event is missing or the circle
     * has no space membership.
     */
    List<CarpoolAcceptedPickupDto> listAcceptedPickupsForFeedEvent(
            UUID circleId, UUID feedEventId);
}
