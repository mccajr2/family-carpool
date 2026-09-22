package com.yourorg.quickapp.events;

import java.util.UUID;

/**
 * Stable carpool-compatible key for a manual event linked to a team feed.
 * Standalone manuals have no eventKey on the calendar row; household plans may
 * still use this string when {@code eventKey} was null.
 */
public final class ManualEventKey {

    private ManualEventKey() {}

    public static String of(UUID manualEventId) {
        return "CAL:MANUAL:" + manualEventId;
    }
}
