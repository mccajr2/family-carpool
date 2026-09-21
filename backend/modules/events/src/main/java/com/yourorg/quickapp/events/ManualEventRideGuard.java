package com.yourorg.quickapp.events;

import java.util.UUID;

/**
 * Carpool side effects for manual-event feed link changes. Implemented by the
 * carpool module (SPI) so events does not depend on carpool.
 */
public interface ManualEventRideGuard {

    /**
     * Throws conflict when this circle has space-scoped PENDING or ACCEPTED
     * rides for {@code eventKey}. Circle-local null-space PLANs do not block.
     */
    void requireNoActiveSpaceRides(UUID circleId, String eventKey);

    /** Cancels this circle's active plans (space + null-space) for {@code eventKey}. */
    void cancelActivePlans(UUID circleId, String eventKey);
}
