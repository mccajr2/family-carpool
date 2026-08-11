package com.yourorg.quickapp.leaveby.internal;

import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic OSRM stub for CI / offline. Returns a fixed 20-minute drive
 * whenever coords are present.
 */
@Component
@ConditionalOnProperty(name = "app.leaveby.osrm.provider", havingValue = "stub", matchIfMissing = false)
class StubOsrmPort implements OsrmPort {

    static final double STUB_DURATION_SECONDS = 1200.0;

    @Override
    public Optional<Double> drivingDurationSeconds(
            double fromLat, double fromLng, double toLat, double toLng) {
        return Optional.of(STUB_DURATION_SECONDS);
    }
}
