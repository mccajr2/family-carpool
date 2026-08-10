package com.yourorg.quickapp.feeds.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
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

    @Test
    void parsesCrossbarLikeFixture() throws IOException {
        List<ParsedIcalEvent> events = parser.parse(readFixture("feeds/crossbar-like.ics"));
        assertThat(events).hasSize(2);
        assertThat(events.get(0).uid()).isEqualTo("crossbar-game-1001@fixture.local");
        assertThat(events.get(0).summary()).isEqualTo("U12 vs Riverside");
        assertThat(events.get(0).location()).isEqualTo("Crossbar Complex Field 2");
        assertThat(events.get(0).startsAt()).isEqualTo(Instant.parse("2026-09-12T18:00:00Z"));
    }

    @Test
    void parsesSportsYouLikeFixtureWithFoldedDescriptionAndAllDay() throws IOException {
        List<ParsedIcalEvent> events = parser.parse(readFixture("feeds/sportsyou-like.ics"));
        assertThat(events).hasSize(2);
        assertThat(events.get(0).uid()).isEqualTo("sportsyou-evt-55@fixture.local");
        assertThat(events.get(0).summary()).isEqualTo("Away Game — Travel");
        // Local TZID times are treated as UTC wall-clock for this minimal parser.
        assertThat(events.get(0).startsAt()).isEqualTo(Instant.parse("2026-09-20T09:00:00Z"));
        assertThat(events.get(0).location()).isEqualTo("Memorial Park");
        assertThat(events.get(1).uid()).isEqualTo("sportsyou-evt-56@fixture.local");
        assertThat(events.get(1).startsAt()).isEqualTo(Instant.parse("2026-09-21T00:00:00Z"));
    }

    @Test
    void parsesSportsEngineLikeFixtureWithEscapedLocationAndMissingUid() throws IOException {
        List<ParsedIcalEvent> events = parser.parse(readFixture("feeds/sportsengine-like.ics"));
        assertThat(events).hasSize(3);
        assertThat(events.get(0).uid()).isEqualTo("se-2026-game-88@fixture.local");
        assertThat(events.get(0).location())
                .isEqualTo("155 Gore St, Cambridge, MA 02141, US");
        assertThat(events.get(2).uid()).isNull();
        assertThat(events.get(2).summary()).isEqualTo("Optional Scrimmage (no UID)");
    }

    @Test
    void unescapesIcalTextEscapes() {
        assertThat(IcalParser.unescapeText("155 Gore St\\, Cambridge\\, MA 02141\\, US"))
                .isEqualTo("155 Gore St, Cambridge, MA 02141, US");
        assertThat(IcalParser.unescapeText("Line1\\nLine2")).isEqualTo("Line1\nLine2");
        assertThat(IcalParser.unescapeText("a\\\\b\\;c")).isEqualTo("a\\b;c");
        assertThat(IcalParser.unescapeText(null)).isNull();
        assertThat(IcalParser.unescapeText("plain")).isEqualTo("plain");
    }

    private static String readFixture(String classpathPath) throws IOException {
        try (var in =
                Objects.requireNonNull(
                        IcalParserTest.class.getClassLoader().getResourceAsStream(classpathPath),
                        "missing fixture " + classpathPath)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
