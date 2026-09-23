package com.yourorg.quickapp.feeds.internal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic fetch for tests. URLs containing {@code fail} throw; URLs
 * containing {@code standing-block-recurring} return four Tuesdays of a
 * two-member drive block (different UIDs each week); URLs containing
 * {@code drive-block} return two back-to-back same-venue practices; others
 * return a small two-event fixture (one with UID, one without).
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
     * Four consecutive Tuesdays (America/New_York 17:00 + 18:00) with distinct
     * UIDs — standing Lock gate (≥3 other matches) + multi-member apply.
     * Instants are 21:00Z / 22:00Z (EDT).
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
        if (lower.contains("drive-block")) {
            return DRIVE_BLOCK_FIXTURE;
        }
        return FIXTURE;
    }
}
