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
     * ACCEPTED rides on this feed event in spaces the circle belongs to (as
     * requester or acceptor). Empty when the event is missing or the circle
     * has no space membership.
     */
    List<CarpoolAcceptedPickupDto> listAcceptedPickupsForFeedEvent(
            UUID circleId, UUID feedEventId);
}
