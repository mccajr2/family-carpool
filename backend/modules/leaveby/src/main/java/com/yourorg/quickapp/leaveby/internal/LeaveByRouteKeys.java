package com.yourorg.quickapp.leaveby.internal;

import java.util.Locale;

/**
 * OSRM coordinate key: {@code lng,lat;lng,lat} at 6 decimal places, matching
 * the public OSRM route path.
 */
final class LeaveByRouteKeys {

    private LeaveByRouteKeys() {}

    static String routeKey(double fromLat, double fromLng, double toLat, double toLng) {
        return String.format(
                Locale.ROOT, "%.6f,%.6f;%.6f,%.6f", fromLng, fromLat, toLng, toLat);
    }
}
