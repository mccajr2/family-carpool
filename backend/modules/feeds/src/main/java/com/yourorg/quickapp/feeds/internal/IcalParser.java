package com.yourorg.quickapp.feeds.internal;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

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
        List<ParsedIcalEvent> events = new ArrayList<>();
        Map<String, String> current = null;
        for (String line : lines) {
            if (line.equalsIgnoreCase("BEGIN:VEVENT")) {
                current = new LinkedHashMap<>();
            } else if (line.equalsIgnoreCase("END:VEVENT")) {
                if (current != null) {
                    ParsedIcalEvent parsed = toEvent(current);
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

    private static ParsedIcalEvent toEvent(Map<String, String> props) {
        Instant start = parseDateTime(props.get("DTSTART_RAW"), props.get("DTSTART"));
        if (start == null) {
            return null;
        }
        Instant end = parseDateTime(props.get("DTEND_RAW"), props.get("DTEND"));
        String summary = props.getOrDefault("SUMMARY", "(no title)");
        if (summary.length() > 500) {
            summary = summary.substring(0, 500);
        }
        String uid = blankToNull(props.get("UID"));
        if (uid != null && uid.length() > 255) {
            uid = uid.substring(0, 255);
        }
        String location = blankToNull(props.get("LOCATION"));
        if (location != null && location.length() > 500) {
            location = location.substring(0, 500);
        }
        return new ParsedIcalEvent(uid, summary, start, end, location);
    }

    private static Instant parseDateTime(String rawWithParams, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        boolean dateOnly =
                (rawWithParams != null && rawWithParams.toUpperCase(Locale.ROOT).contains("VALUE=DATE"))
                        || (v.length() == 8 && !v.contains("T"));
        try {
            if (dateOnly) {
                LocalDate date = LocalDate.parse(v.substring(0, 8), BASIC_DATE);
                return date.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            if (v.endsWith("Z")) {
                return LocalDateTime.parse(v, BASIC_UTC).toInstant(ZoneOffset.UTC);
            }
            return LocalDateTime.parse(v, BASIC_LOCAL).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException | StringIndexOutOfBoundsException ex) {
            return null;
        }
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
