package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RideEventKeyTest {

    @Test
    void prefersIcalUid() {
        FeedCalendarEventDto event =
                event("stub-game-1@example.com", "Practice", "Field 3");

        assertThat(RideEventKey.of(event)).isEqualTo("UID:stub-game-1@example.com");
    }

    @Test
    void fingerprintsWhenUidMissing() {
        FeedCalendarEventDto event = event(null, "Practice", "Field 3");

        assertThat(RideEventKey.of(event))
                .isEqualTo("FP:practice|2026-08-15T17:00:00Z|field 3");
    }

    @Test
    void fingerprintTreatsBlankLocationAsEmpty() {
        FeedCalendarEventDto event = event("  ", " Scrimmage ", null);

        assertThat(RideEventKey.of(event)).isEqualTo("FP:scrimmage|2026-08-15T17:00:00Z|");
    }

    @Test
    void delegatesToFeedEventKey() {
        FeedCalendarEventDto withUid =
                event("stub-game-1@example.com", "Practice", "Field 3");
        FeedCalendarEventDto fingerprint = event(null, " Scrimmage ", null);

        assertThat(RideEventKey.of(withUid)).isEqualTo(FeedEventKey.of(withUid));
        assertThat(RideEventKey.of(fingerprint)).isEqualTo(FeedEventKey.of(fingerprint));
    }

    private static FeedCalendarEventDto event(String uid, String title, String location) {
        return new FeedCalendarEventDto(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Soccer",
                uid,
                title,
                Instant.parse("2026-08-15T17:00:00Z"),
                Instant.parse("2026-08-15T18:00:00Z"),
                location,
                List.of());
    }
}
