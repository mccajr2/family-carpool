package com.yourorg.quickapp.feeds.internal;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/** Minimal VEVENT extractor — no third-party iCal dependency. */
@Component
class IcalParser {

    private static final DateTimeFormatter BASIC_UTC =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    private static final DateTimeFormatter BASIC_LOCAL =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
    private static final DateTimeFormatter BASIC_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    List<ParsedIcalEvent> parse(String icalText) {
        if (icalText == null || icalText.isBlank()) {
            return List.of();
        }
        List<String> lines = unfold(icalText);
        String calendarTimeZone = findCalendarTimeZone(lines);
        List<ParsedIcalEvent> events = new ArrayList<>();
        Map<String, String> current = null;
        for (String line : lines) {
            if (line.equalsIgnoreCase("BEGIN:VEVENT")) {
                current = new LinkedHashMap<>();
            } else if (line.equalsIgnoreCase("END:VEVENT")) {
                if (current != null) {
                    ParsedIcalEvent parsed = toEvent(current, calendarTimeZone);
                    if (parsed != null) {
                        events.add(parsed);
                    }
                }
                current = null;
            } else if (current != null) {
                int colon = line.indexOf(':');
                if (colon > 0) {
                    String keyPart = line.substring(0, colon);
                    String value = line.substring(colon + 1).trim();
                    String name = keyPart.split(";", 2)[0].toUpperCase(Locale.ROOT);
                    current.put(name, value);
                    if (name.equals("DTSTART") || name.equals("DTEND")) {
                        current.put(name + "_RAW", keyPart + ":" + value);
                    }
                }
            }
        }
        return events;
    }

    private static ParsedIcalEvent toEvent(Map<String, String> props, String calendarTimeZone) {
        Instant start =
                parseDateTime(props.get("DTSTART_RAW"), props.get("DTSTART"), calendarTimeZone);
        if (start == null) {
            return null;
        }
        Instant end = parseDateTime(props.get("DTEND_RAW"), props.get("DTEND"), calendarTimeZone);
        String summary = normalizeIcalText(props.getOrDefault("SUMMARY", "(no title)"));
        if (summary.length() > 500) {
            summary = summary.substring(0, 500);
        }
        String uid = blankToNull(props.get("UID"));
        if (uid != null && uid.length() > 255) {
            uid = uid.substring(0, 255);
        }
        String location = blankToNull(normalizeIcalText(props.get("LOCATION")));
        if (location != null && location.length() > 500) {
            location = location.substring(0, 500);
        }
        return new ParsedIcalEvent(uid, summary, start, end, location);
    }

    /**
     * RFC 5545 TEXT unescape, then HTML-entity decode. SportsEngine-style feeds put
     * {@code &amp;} in SUMMARY/LOCATION; RFC unescape alone leaves that literal.
     */
    static String normalizeIcalText(String value) {
        String unescaped = unescapeText(value);
        if (unescaped == null || unescaped.isEmpty()) {
            return unescaped;
        }
        return HtmlUtils.htmlUnescape(unescaped);
    }

    /**
     * RFC 5545 TEXT unescaping: {@code \\} {@code \,} {@code \;} {@code \n}/{@code \N}.
     * SportsEngine (and many iCal exporters) escape commas in LOCATION this way.
     */
    static String unescapeText(String value) {
        if (value == null || value.isEmpty() || value.indexOf('\\') < 0) {
            return value;
        }
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\\' && i + 1 < value.length()) {
                char next = value.charAt(++i);
                switch (next) {
                    case 'n', 'N' -> out.append('\n');
                    case ',', ';', '\\' -> out.append(next);
                    default -> {
                        out.append('\\');
                        out.append(next);
                    }
                }
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    private static Instant parseDateTime(
            String rawWithParams, String value, String calendarTimeZone) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        boolean dateOnly =
                (rawWithParams != null
                                && rawWithParams.toUpperCase(Locale.ROOT).contains("VALUE=DATE"))
                        || (v.length() == 8 && !v.contains("T"));
        try {
            if (dateOnly) {
                LocalDate date = LocalDate.parse(v.substring(0, 8), BASIC_DATE);
                return date.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            if (v.endsWith("Z")) {
                return LocalDateTime.parse(v, BASIC_UTC).toInstant(ZoneOffset.UTC);
            }
            LocalDateTime local = LocalDateTime.parse(v, BASIC_LOCAL);
            ZoneId zone = resolveZone(extractTzid(rawWithParams), calendarTimeZone);
            if (zone != null) {
                return local.atZone(zone).toInstant();
            }
            // Floating local time with no TZID / X-WR-TIMEZONE: treat as UTC wall-clock.
            return local.toInstant(ZoneOffset.UTC);
        } catch (DateTimeException | StringIndexOutOfBoundsException ex) {
            return null;
        }
    }

    /** Prefer event TZID; else calendar {@code X-WR-TIMEZONE}. */
    private static ZoneId resolveZone(String eventTzid, String calendarTimeZone) {
        String id = blankToNull(eventTzid);
        if (id == null) {
            id = blankToNull(calendarTimeZone);
        }
        if (id == null) {
            return null;
        }
        try {
            return ZoneId.of(id);
        } catch (DateTimeException ex) {
            return null;
        }
    }

    static String extractTzid(String rawWithParams) {
        if (rawWithParams == null || rawWithParams.isBlank()) {
            return null;
        }
        String upper = rawWithParams.toUpperCase(Locale.ROOT);
        int idx = upper.indexOf("TZID=");
        if (idx < 0) {
            return null;
        }
        int start = idx + "TZID=".length();
        if (start >= rawWithParams.length()) {
            return null;
        }
        if (rawWithParams.charAt(start) == '"') {
            int end = rawWithParams.indexOf('"', start + 1);
            if (end < 0) {
                return null;
            }
            return rawWithParams.substring(start + 1, end).trim();
        }
        int end = start;
        while (end < rawWithParams.length()) {
            char c = rawWithParams.charAt(end);
            if (c == ';' || c == ':') {
                break;
            }
            end++;
        }
        return rawWithParams.substring(start, end).trim();
    }

    private static String findCalendarTimeZone(List<String> lines) {
        for (String line : lines) {
            int colon = line.indexOf(':');
            if (colon <= 0) {
                continue;
            }
            String name = line.substring(0, colon).split(";", 2)[0].trim();
            if (name.equalsIgnoreCase("X-WR-TIMEZONE")) {
                return blankToNull(line.substring(colon + 1));
            }
        }
        return null;
    }

    private static List<String> unfold(String text) {
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        String[] raw = normalized.split("\n");
        List<String> out = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : raw) {
            if (line.startsWith(" ") || line.startsWith("\t")) {
                current.append(line.substring(1));
            } else {
                if (!current.isEmpty()) {
                    out.add(current.toString());
                    current.setLength(0);
                }
                current.append(line);
            }
        }
        if (!current.isEmpty()) {
            out.add(current.toString());
        }
        return out;
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
