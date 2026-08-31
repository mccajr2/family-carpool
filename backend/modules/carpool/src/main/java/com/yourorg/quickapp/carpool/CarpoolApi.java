package com.yourorg.quickapp.carpool;

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
}
