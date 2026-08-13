package com.yourorg.quickapp.leaveby.internal;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic OSRM stub for CI / offline. Returns a fixed 20-minute drive
 * whenever coords are present.
 */
@Component
@ConditionalOnProperty(name = "app.leaveby.osrm.provider", havingValue = "stub", matchIfMissing = false)
public class StubOsrmPort implements OsrmPort {

    static final double STUB_DURATION_SECONDS = 1200.0;

    private final AtomicInteger httpCalls = new AtomicInteger();

    /** OSRM-equivalent invocations (stub HTTP). */
    public int httpCallCount() {
        return httpCalls.get();
    }

    @Override
    public Optional<Double> drivingDurationSeconds(
            double fromLat, double fromLng, double toLat, double toLng) {
        httpCalls.incrementAndGet();
        return Optional.of(STUB_DURATION_SECONDS);
    }
}
