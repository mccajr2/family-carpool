package com.yourorg.quickapp.leaveby;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** Stub notify channel for pickup contacts (delivery out of scope). */
public enum CalendarRouteNotifyChannel {
    PUSH,
    SMS;

    @JsonValue
    public String wireValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static CalendarRouteNotifyChannel fromWire(String wire) {
        if (wire == null || wire.isBlank()) {
            throw new IllegalArgumentException("Missing notify channel");
        }
        return CalendarRouteNotifyChannel.valueOf(wire.trim().toUpperCase(Locale.ROOT));
    }
}
