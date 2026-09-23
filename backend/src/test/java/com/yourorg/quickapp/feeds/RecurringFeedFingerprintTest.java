package com.yourorg.quickapp.feeds;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RecurringFeedFingerprintTest {

    private static final ZoneId EASTERN = ZoneId.of("America/New_York");
    private static final UUID FEED_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    @Test
    void matchesAcrossWeeksWithDifferentUidsAndEventIds() {
        // Tue 2026-09-01 17:00 EDT and Tue 2026-09-08 17:00 EDT
        FeedCalendarEventDto week1 =
                event(
                        UUID.randomUUID(),
                        FEED_ID,
                        "uid-week-1",
                        Instant.parse("2026-09-01T21:00:00Z"),
                        "Rink A");
        FeedCalendarEventDto week2 =
                event(
                        UUID.randomUUID(),
                        FEED_ID,
                        "uid-week-2",
                        Instant.parse("2026-09-08T21:00:00Z"),
                        "Rink A");

        assertThat(RecurringFeedFingerprint.of(week1, EASTERN))
                .isEqualTo(RecurringFeedFingerprint.of(week2, EASTERN));
        assertThat(RecurringFeedFingerprint.of(week1, EASTERN).dayOfWeek())
                .isEqualTo(DayOfWeek.TUESDAY);
        assertThat(RecurringFeedFingerprint.of(week1, EASTERN).minuteOfDay())
                .isEqualTo(17 * 60);
    }

    @Test
    void differentLocationDoesNotMatch() {
        Instant start = Instant.parse("2026-09-01T21:00:00Z");
        RecurringFeedFingerprint rinkA =
                RecurringFeedFingerprint.of(FEED_ID, start, "Rink A", EASTERN);
        RecurringFeedFingerprint rinkB =
                RecurringFeedFingerprint.of(FEED_ID, start, "Rink B", EASTERN);

        assertThat(rinkA).isNotEqualTo(rinkB);
    }

    @Test
    void sameUtcInstantDifferentLocalWeekdayDoesNotMatch() {
        // 2026-09-01 02:00Z = Mon 22:00 EDT (Aug 31) vs Tue 02:00 UTC
        Instant start = Instant.parse("2026-09-01T02:00:00Z");
        RecurringFeedFingerprint eastern =
                RecurringFeedFingerprint.of(FEED_ID, start, "Rink A", EASTERN);
        RecurringFeedFingerprint utc =
                RecurringFeedFingerprint.of(FEED_ID, start, "Rink A", ZoneId.of("UTC"));

        assertThat(eastern.dayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(utc.dayOfWeek()).isEqualTo(DayOfWeek.TUESDAY);
        assertThat(eastern).isNotEqualTo(utc);
    }

    @Test
    void truncatesSecondsToMinute() {
        RecurringFeedFingerprint onMinute =
                RecurringFeedFingerprint.of(
                        FEED_ID, Instant.parse("2026-09-01T21:00:00Z"), "Rink", EASTERN);
        RecurringFeedFingerprint withSeconds =
                RecurringFeedFingerprint.of(
                        FEED_ID, Instant.parse("2026-09-01T21:00:45Z"), "Rink", EASTERN);

        assertThat(onMinute).isEqualTo(withSeconds);
        assertThat(onMinute.minuteOfDay()).isEqualTo(17 * 60);
    }

    @Test
    void normalizesLocationLikeFeedEventKey() {
        RecurringFeedFingerprint spaced =
                RecurringFeedFingerprint.of(
                        FEED_ID, Instant.parse("2026-09-01T21:00:00Z"), "  Rink A ", EASTERN);
        RecurringFeedFingerprint mixed =
                RecurringFeedFingerprint.of(
                        FEED_ID, Instant.parse("2026-09-01T21:00:00Z"), "rink a", EASTERN);
        RecurringFeedFingerprint blank =
                RecurringFeedFingerprint.of(
                        FEED_ID, Instant.parse("2026-09-01T21:00:00Z"), null, EASTERN);

        assertThat(spaced).isEqualTo(mixed);
        assertThat(blank.normalizedLocation()).isEmpty();
        assertThat(RecurringFeedFingerprint.normalizeLocation("  Field 3 "))
                .isEqualTo("field 3");
    }

    @Test
    void differentFeedIdDoesNotMatch() {
        Instant start = Instant.parse("2026-09-01T21:00:00Z");
        RecurringFeedFingerprint a =
                RecurringFeedFingerprint.of(FEED_ID, start, "Rink A", EASTERN);
        RecurringFeedFingerprint b =
                RecurringFeedFingerprint.of(UUID.randomUUID(), start, "Rink A", EASTERN);

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void encodedIsStable() {
        RecurringFeedFingerprint fp =
                RecurringFeedFingerprint.of(
                        FEED_ID, Instant.parse("2026-09-01T21:00:00Z"), "Rink A", EASTERN);

        assertThat(fp.encoded())
                .isEqualTo(FEED_ID + "|TUESDAY|" + (17 * 60) + "|rink a");
    }

    @Test
    void rejectsOutOfRangeMinuteOfDay() {
        assertThatThrownBy(
                        () ->
                                new RecurringFeedFingerprint(
                                        FEED_ID, DayOfWeek.MONDAY, 24 * 60, ""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static FeedCalendarEventDto event(
            UUID id, UUID feedId, String uid, Instant startsAt, String location) {
        return new FeedCalendarEventDto(
                id,
                feedId,
                "Mites",
                uid,
                "Practice",
                startsAt,
                startsAt.plusSeconds(3600),
                location,
                List.of());
    }
}
