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
        // 09:00 America/New_York on 2026-09-20 is EDT (UTC-4) → 13:00Z
        assertThat(events.get(0).startsAt()).isEqualTo(Instant.parse("2026-09-20T13:00:00Z"));
        assertThat(events.get(0).endsAt()).isEqualTo(Instant.parse("2026-09-20T14:30:00Z"));
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
        // 08:00–08:50 America/New_York on 2026-10-05 is EDT → 12:00–12:50Z (not 4am Eastern)
        assertThat(events.get(0).startsAt()).isEqualTo(Instant.parse("2026-10-05T12:00:00Z"));
        assertThat(events.get(0).endsAt()).isEqualTo(Instant.parse("2026-10-05T12:50:00Z"));
        assertThat(events.get(2).uid()).isNull();
        assertThat(events.get(2).summary()).isEqualTo("Optional Scrimmage (no UID)");
        assertThat(events.get(2).startsAt()).isEqualTo(Instant.parse("2026-10-08T17:00:00Z"));
    }

    @Test
    void usesCalendarXWrTimezoneForFloatingLocalTimes() {
        String ical =
                """
                BEGIN:VCALENDAR
                X-WR-TIMEZONE:America/New_York
                BEGIN:VEVENT
                UID:float-1
                DTSTART:20260905T080000
                DTEND:20260905T085000
                SUMMARY:Practice
                END:VEVENT
                END:VCALENDAR
                """;
        List<ParsedIcalEvent> events = parser.parse(ical);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().startsAt()).isEqualTo(Instant.parse("2026-09-05T12:00:00Z"));
        assertThat(events.getFirst().endsAt()).isEqualTo(Instant.parse("2026-09-05T12:50:00Z"));
    }

    @Test
    void extractTzid_readsQuotedAndBareValues() {
        assertThat(IcalParser.extractTzid("DTSTART;TZID=America/New_York:20260905T080000"))
                .isEqualTo("America/New_York");
        assertThat(IcalParser.extractTzid("DTSTART;TZID=\"America/New_York\":20260905T080000"))
                .isEqualTo("America/New_York");
        assertThat(IcalParser.extractTzid("DTSTART:20260905T080000Z")).isNull();
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

    @Test
    void normalizeIcalText_decodesHtmlEntitiesAndIcalEscapes() {
        assertThat(IcalParser.normalizeIcalText("Team &amp; Family Meeting"))
                .isEqualTo("Team & Family Meeting");
        assertThat(IcalParser.normalizeIcalText("A &lt; B")).isEqualTo("A < B");
        assertThat(IcalParser.normalizeIcalText("it&#39;s")).isEqualTo("it's");
        assertThat(IcalParser.normalizeIcalText("&quot;quoted&quot;")).isEqualTo("\"quoted\"");
        assertThat(IcalParser.normalizeIcalText("155 Gore St\\, Cambridge"))
                .isEqualTo("155 Gore St, Cambridge");
        assertThat(IcalParser.normalizeIcalText("A & B")).isEqualTo("A & B");
        assertThat(IcalParser.normalizeIcalText(null)).isNull();
        assertThat(IcalParser.normalizeIcalText("plain")).isEqualTo("plain");
    }

    @Test
    void decodesHtmlEntitiesInSummaryAndLocation() {
        String ical =
                """
                BEGIN:VCALENDAR
                BEGIN:VEVENT
                UID:html-1
                DTSTART:20260905T080000Z
                SUMMARY:2016/2017 (BILL): Team &amp; Family Meeting
                LOCATION:Rink &lt;A&gt; &#39;Main&#39;
                END:VEVENT
                END:VCALENDAR
                """;
        List<ParsedIcalEvent> events = parser.parse(ical);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().summary())
                .isEqualTo("2016/2017 (BILL): Team & Family Meeting");
        assertThat(events.getFirst().location()).isEqualTo("Rink <A> 'Main'");
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
