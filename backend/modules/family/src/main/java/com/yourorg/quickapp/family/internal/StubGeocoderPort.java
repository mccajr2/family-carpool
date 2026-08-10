package com.yourorg.quickapp.family.internal;

import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic geocoder for tests and local soft-fail demos. Returns coords for
 * addresses that do not contain {@code unlocateable} (case-insensitive).
 */
@Component
@ConditionalOnProperty(name = "app.geocode.provider", havingValue = "stub", matchIfMissing = false)
class StubGeocoderPort implements GeocoderPort {

    @Override
    public Optional<GeoCoordinates> geocode(String address) {
        if (address == null || address.isBlank()) {
            return Optional.empty();
        }
        if (address.toLowerCase().contains("unlocateable")) {
            return Optional.empty();
        }
        // Stable pseudo-coords derived from address length for easy assertions.
        double lat = 40.0 + (address.trim().length() % 100) / 1000.0;
        double lng = -74.0 - (address.trim().length() % 100) / 1000.0;
        return Optional.of(new GeoCoordinates(lat, lng));
    }
}
