package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;

final class RideEventKey {

    private RideEventKey() {}

    static String of(FeedCalendarEventDto event) {
        return FeedEventKey.of(event);
    }
}
