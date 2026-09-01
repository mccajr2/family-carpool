package com.yourorg.quickapp.leaveby.internal;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic OSRM stub for CI / offline. Duration scales with coordinate delta
 * so multi-leg detour math is non-trivial in integration tests.
 */
@Component
@ConditionalOnProperty(name = "app.leaveby.osrm.provider", havingValue = "stub", matchIfMissing = false)
public class StubOsrmPort implements OsrmPort {

    private static final double BASE_SECONDS = 600.0;
    private static final double SECONDS_PER_DEGREE = 3600.0;

    private final AtomicInteger httpCalls = new AtomicInteger();

    /** OSRM-equivalent invocations (stub HTTP). */
    public int httpCallCount() {
        return httpCalls.get();
    }

    public static double drivingDurationSecondsForCoords(
            double fromLat, double fromLng, double toLat, double toLng) {
        double delta = Math.abs(fromLat - toLat) + Math.abs(fromLng - toLng);
        return BASE_SECONDS + delta * SECONDS_PER_DEGREE;
    }

    @Override
    public Optional<Double> drivingDurationSeconds(
            double fromLat, double fromLng, double toLat, double toLng) {
        httpCalls.incrementAndGet();
        return Optional.of(
                drivingDurationSecondsForCoords(fromLat, fromLng, toLat, toLng));
    }
}
