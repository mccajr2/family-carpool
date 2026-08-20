package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import java.util.Locale;

final class RideEventKey {

    private RideEventKey() {}

    static String of(FeedCalendarEventDto event) {
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
