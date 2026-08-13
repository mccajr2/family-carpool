package com.yourorg.quickapp.family;

import java.util.Optional;

/**
 * Public soft-fail geocode for free-text strings (event locations / addresses).
 * Reuses the same Nominatim + {@code geocode_cache} path as named places.
 * Does not include routing / OSRM.
 */
public interface FamilyGeocodeApi {

    /**
     * Resolve coordinates for free-text location. Empty on blank, oversize,
     * cache miss with provider miss, or provider error (soft-fail).
     */
    Optional<GeoPointDto> resolveLocation(String locationText);

    /**
     * Cache-only lookup. Empty on blank, oversize, or {@code geocode_cache}
     * miss — never calls Nominatim.
     */
    Optional<GeoPointDto> findCachedLocation(String locationText);
}
