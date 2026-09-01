package com.yourorg.quickapp.carpool.internal;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses a display town label from a ride pickup address snapshot. */
final class PickupTownParser {

    /**
     * Last {@code City, ST} segment before an optional ZIP at end of address, e.g.
     * {@code 123 Main St, Cambridge, MA 02139} → {@code Cambridge, MA}. When no
     * match, returns the full trimmed address. Returns {@code null} when input is
     * null or blank.
     */
    private static final Pattern LAST_CITY_STATE =
            Pattern.compile(
                    "(?:.*,\\s*)?"
                            + "([A-Za-z][A-Za-z .'\\-]*?)\\s*,\\s*"
                            + "([A-Z]{2})"
                            + "(?:\\s+(?:\\d{5}(?:-\\d{4})?))?"
                            + "\\s*$",
                    Pattern.CASE_INSENSITIVE);

    private PickupTownParser() {}

    static String pickupTownFromAddress(String pickupAddress) {
        if (pickupAddress == null) {
            return null;
        }
        String trimmed = pickupAddress.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        Matcher matcher = LAST_CITY_STATE.matcher(trimmed);
        if (matcher.find()) {
            String city = matcher.group(1).trim();
            String state = matcher.group(2).toUpperCase();
            return city + ", " + state;
        }
        return trimmed;
    }
}
