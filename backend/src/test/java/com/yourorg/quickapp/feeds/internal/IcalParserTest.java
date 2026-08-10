package com.yourorg.quickapp.feeds.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class IcalParserTest {

    private final IcalParser parser = new IcalParser();

    @Test
    void parsesEventsWithAndWithoutUid() {
        List<ParsedIcalEvent> events = parser.parse(StubIcalFetchPort.FIXTURE);
        assertThat(events).hasSize(2);
        assertThat(events.get(0).uid()).isEqualTo("stub-game-1@example.com");
        assertThat(events.get(0).summary()).isEqualTo("Practice");
        assertThat(events.get(0).location()).isEqualTo("Field 3");
        assertThat(events.get(0).startsAt()).isEqualTo(Instant.parse("2026-08-15T17:00:00Z"));
        assertThat(events.get(1).uid()).isNull();
        assertThat(events.get(1).summary()).isEqualTo("Scrimmage");
    }

    @Test
    void parsesAllDayDateAsUtcMidnight() {
        String ical =
                """
                BEGIN:VCALENDAR
                BEGIN:VEVENT
                UID:day-1
                DTSTART;VALUE=DATE:20260901
                SUMMARY:Tournament day
                END:VEVENT
                END:VCALENDAR
                """;
        List<ParsedIcalEvent> events = parser.parse(ical);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().startsAt()).isEqualTo(Instant.parse("2026-09-01T00:00:00Z"));
    }
}
