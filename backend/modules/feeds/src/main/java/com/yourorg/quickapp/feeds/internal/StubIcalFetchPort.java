package com.yourorg.quickapp.feeds.internal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic fetch for tests. URLs containing {@code fail} throw; URLs
 * containing {@code drive-block} return two back-to-back same-venue practices;
 * others return a small two-event fixture (one with UID, one without).
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

    @Override
    public String fetch(String httpsUrl) {
        String lower = httpsUrl == null ? "" : httpsUrl.toLowerCase();
        if (lower.contains("fail")) {
            throw new IllegalStateException("Stub fetch failed for " + httpsUrl);
        }
        if (lower.contains("drive-block")) {
            return DRIVE_BLOCK_FIXTURE;
        }
        return FIXTURE;
    }
}
