package com.yourorg.quickapp.leaveby.internal;

import java.util.Optional;

/** Driving-duration port (OSRM PoC). Empty means provider down / unreachable. */
interface OsrmPort {

    Optional<Double> drivingDurationSeconds(
            double fromLat, double fromLng, double toLat, double toLng);
}
