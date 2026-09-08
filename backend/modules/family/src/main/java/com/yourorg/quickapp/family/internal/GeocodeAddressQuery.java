package com.yourorg.quickapp.family.internal;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds the string sent to Nominatim from free-text place / event location.
 * SportsEngine-style iCal {@code LOCATION} often prefixes a venue name before
 * the street address with no separator; that compound query returns no hit.
 */
final class GeocodeAddressQuery {

    /**
     * Leading venue text, then a US-style house number and street token.
     * Group 1 = prefix (may be blank); group 2 = street from house number.
     */
    private static final Pattern VENUE_THEN_STREET =
            Pattern.compile("^(.*?)\\b(\\d{1,6}\\s+[A-Za-z].+)$");

    private GeocodeAddressQuery() {}

    /**
     * When {@code address} has a non-blank venue prefix before a house number,
     * returns the street portion; otherwise the trimmed input (or empty).
     */
    static String forGeocode(String address) {
        if (address == null) {
            return "";
        }
        String trimmed = address.trim();
        if (trimmed.isEmpty()) {
            return trimmed;
        }
        Matcher m = VENUE_THEN_STREET.matcher(trimmed);
        if (!m.matches()) {
            return trimmed;
        }
        String prefix = m.group(1).trim();
        String street = m.group(2).trim();
        if (prefix.isEmpty() || street.isEmpty()) {
            return trimmed;
        }
        return street;
    }
}
