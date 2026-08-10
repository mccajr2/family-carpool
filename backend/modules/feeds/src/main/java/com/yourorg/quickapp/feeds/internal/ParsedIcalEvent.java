package com.yourorg.quickapp.feeds.internal;

import java.time.Instant;

/** One VEVENT after parse. */
record ParsedIcalEvent(
        String uid, String summary, Instant startsAt, Instant endsAt, String location) {}
