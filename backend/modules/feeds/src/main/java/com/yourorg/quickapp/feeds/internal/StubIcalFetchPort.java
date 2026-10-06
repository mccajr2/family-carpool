package com.yourorg.quickapp.feeds.internal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic fetch for tests. URLs containing {@code fail} throw; URLs
 * containing {@code standing-block-recurring} return four Tuesdays of a
 * two-member drive block (different UIDs each week); URLs containing
 * {@code standing-ride-series} return nine future Tuesdays for standing Ask
 * gate tests; URLs containing {@code drive-block} return two back-to-back
 * same-venue practices; others return a small two-event fixture (one with
 * UID, one without).
 */
@Component
@ConditionalOnProperty(name = "app.feeds.fetch-provider", havingValue = "stub")
class StubIcalFetchPort implements IcalFetchPort {

    static final String FIXTURE =
            """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//family-carpool//stub//EN
            BEGIN:VEVENT
            UID:stub-game-1@example.com
            DTSTART:20260815T170000Z
            DTEND:20260815T180000Z
            SUMMARY:Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            DTSTART:20260816T090000Z
            DTEND:20260816T100000Z
            SUMMARY:Scrimmage
            END:VEVENT
            END:VCALENDAR
            """;

    /** Back-to-back same location for driving-block merge / accept membership tests. */
    static final String DRIVE_BLOCK_FIXTURE =
            """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//family-carpool//stub-drive-block//EN
            BEGIN:VEVENT
            UID:stub-drive-block-a@example.com
            DTSTART:20260815T170000Z
            DTEND:20260815T180000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-drive-block-b@example.com
            DTSTART:20260815T180000Z
            DTEND:20260815T190000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            END:VCALENDAR
            """;

    /**
     * Four consecutive Tuesdays was enough for the gate; six weeks let dogfood
     * assert known-schedule apply beyond a 14-day Agenda window (w1 lock +
     * blank w2–w6). Instants are 21:00Z / 22:00Z (EDT).
     */
    static final String STANDING_BLOCK_RECURRING_FIXTURE =
            """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//family-carpool//stub-standing-block-recurring//EN
            BEGIN:VEVENT
            UID:stub-standing-a-w1@example.com
            DTSTART:20260901T210000Z
            DTEND:20260901T220000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-b-w1@example.com
            DTSTART:20260901T220000Z
            DTEND:20260901T230000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-a-w2@example.com
            DTSTART:20260908T210000Z
            DTEND:20260908T220000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-b-w2@example.com
            DTSTART:20260908T220000Z
            DTEND:20260908T230000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-a-w3@example.com
            DTSTART:20260915T210000Z
            DTEND:20260915T220000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-b-w3@example.com
            DTSTART:20260915T220000Z
            DTEND:20260915T230000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-a-w4@example.com
            DTSTART:20260922T210000Z
            DTEND:20260922T220000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-b-w4@example.com
            DTSTART:20260922T220000Z
            DTEND:20260922T230000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-a-w5@example.com
            DTSTART:20260929T210000Z
            DTEND:20260929T220000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-b-w5@example.com
            DTSTART:20260929T220000Z
            DTEND:20260929T230000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-a-w6@example.com
            DTSTART:20261006T210000Z
            DTEND:20261006T220000Z
            SUMMARY:Practice A
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-b-w6@example.com
            DTSTART:20261006T220000Z
            DTEND:20261006T230000Z
            SUMMARY:Practice B
            LOCATION:Field 3
            END:VEVENT
            END:VCALENDAR
            """;

    /**
     * Nine Tuesday practices starting 2026-12-01 — enough ≥3 other upcoming
     * matches when "today" is autumn 2026 (standing Ask gate). Keep w1 after
     * Instant.now() in CI so unanswered-expire does not fire mid-test.
     */
    static final String STANDING_RIDE_SERIES_FIXTURE =
            """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//family-carpool//stub-standing-ride-series//EN
            BEGIN:VEVENT
            UID:stub-standing-ride-w1@example.com
            DTSTART:20261201T210000Z
            DTEND:20261201T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w2@example.com
            DTSTART:20261208T210000Z
            DTEND:20261208T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w3@example.com
            DTSTART:20261215T210000Z
            DTEND:20261215T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w4@example.com
            DTSTART:20261222T210000Z
            DTEND:20261222T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w5@example.com
            DTSTART:20261229T210000Z
            DTEND:20261229T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w6@example.com
            DTSTART:20270105T210000Z
            DTEND:20270105T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w7@example.com
            DTSTART:20270112T210000Z
            DTEND:20270112T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w8@example.com
            DTSTART:20270119T210000Z
            DTEND:20270119T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            BEGIN:VEVENT
            UID:stub-standing-ride-w9@example.com
            DTSTART:20270126T210000Z
            DTEND:20270126T220000Z
            SUMMARY:Standing Practice
            LOCATION:Field 3
            END:VEVENT
            END:VCALENDAR
            """;

    @Override
    public String fetch(String httpsUrl) {
        String lower = httpsUrl == null ? "" : httpsUrl.toLowerCase();
        if (lower.contains("fail")) {
            throw new IllegalStateException("Stub fetch failed for " + httpsUrl);
        }
        if (lower.contains("standing-block-recurring")) {
            return STANDING_BLOCK_RECURRING_FIXTURE;
        }
        if (lower.contains("standing-ride-series")) {
            return STANDING_RIDE_SERIES_FIXTURE;
        }
        if (lower.contains("drive-block")) {
            return DRIVE_BLOCK_FIXTURE;
        }
        return FIXTURE;
    }
}
