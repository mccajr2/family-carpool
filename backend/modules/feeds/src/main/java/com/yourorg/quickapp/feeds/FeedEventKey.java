package com.yourorg.quickapp.feeds;

import java.util.Locale;

/**
 * Stable carpool-compatible key for a synced feed event. Prefer iCal UID
 * ({@code UID:…}); otherwise fingerprint title|startsAt|location ({@code FP:…}).
 */
public final class FeedEventKey {

    private FeedEventKey() {}

    public static String of(FeedCalendarEventDto event) {
        String uid = event.uid();
        if (uid != null && !uid.isBlank()) {
            return "UID:" + uid.trim();
        }
        return "FP:"
                + normalize(event.title())
                + "|"
                + event.startsAt()
                + "|"
                + normalize(event.location());
    }

    static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
