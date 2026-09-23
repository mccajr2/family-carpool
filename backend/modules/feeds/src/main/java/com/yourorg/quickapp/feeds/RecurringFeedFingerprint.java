package com.yourorg.quickapp.feeds;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * Series substitute for a FEED calendar item when locking a standing household
 * plan. Keys on feed + local weekday + local start time-of-day (minute) +
 * normalized location — not per-occurrence iCal UID / event UUID.
 */
public record RecurringFeedFingerprint(
        UUID feedId, DayOfWeek dayOfWeek, int minuteOfDay, String normalizedLocation) {

    public RecurringFeedFingerprint {
        Objects.requireNonNull(feedId, "feedId");
        Objects.requireNonNull(dayOfWeek, "dayOfWeek");
        if (minuteOfDay < 0 || minuteOfDay > 24 * 60 - 1) {
            throw new IllegalArgumentException("minuteOfDay out of range: " + minuteOfDay);
        }
        normalizedLocation = normalizeLocation(normalizedLocation);
    }

    public static RecurringFeedFingerprint of(
            UUID feedId, Instant startsAt, String location, ZoneId zone) {
        Objects.requireNonNull(startsAt, "startsAt");
        Objects.requireNonNull(zone, "zone");
        ZonedDateTime local = startsAt.atZone(zone);
        LocalTime time = local.toLocalTime();
        int minuteOfDay = time.getHour() * 60 + time.getMinute();
        return new RecurringFeedFingerprint(
                feedId, local.getDayOfWeek(), minuteOfDay, location);
    }

    public static RecurringFeedFingerprint of(FeedCalendarEventDto event, ZoneId zone) {
        Objects.requireNonNull(event, "event");
        return of(event.feedId(), event.startsAt(), event.location(), zone);
    }

    public static String normalizeLocation(String location) {
        return location == null ? "" : location.trim().toLowerCase(Locale.ROOT);
    }

    /** Stable encoding for template persistence / ordered fingerprint sets. */
    public String encoded() {
        return feedId + "|" + dayOfWeek.name() + "|" + minuteOfDay + "|" + normalizedLocation;
    }
}
