package com.yourorg.quickapp.leaveby;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** Role of a stop in the multi-stop itinerary (OpenAPI wire values are lowercase). */
public enum CalendarRouteStopKind {
    HOME,
    PICKUP,
    DESTINATION;

    @JsonValue
    public String wireValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static CalendarRouteStopKind fromWire(String wire) {
        if (wire == null || wire.isBlank()) {
            throw new IllegalArgumentException("Missing stop kind");
        }
        return CalendarRouteStopKind.valueOf(wire.trim().toUpperCase(Locale.ROOT));
    }
}
