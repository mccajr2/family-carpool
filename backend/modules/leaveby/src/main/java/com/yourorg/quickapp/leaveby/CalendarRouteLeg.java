package com.yourorg.quickapp.leaveby;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** Driving direction for a calendar route itinerary (OpenAPI: TO | FROM). */
public enum CalendarRouteLeg {
    TO,
    FROM;

    @JsonValue
    public String wireValue() {
        return name();
    }

    public static CalendarRouteLeg fromWire(String wire) {
        if (wire == null || wire.isBlank()) {
            return TO;
        }
        return CalendarRouteLeg.valueOf(wire.trim().toUpperCase(Locale.ROOT));
    }
}
