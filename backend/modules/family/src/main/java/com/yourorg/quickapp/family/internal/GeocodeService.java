package com.yourorg.quickapp.family.internal;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class GeocodeService {

    private final GeocoderPort geocoder;
    private final GeocodeCacheRepository cacheRepository;

    GeocodeService(GeocoderPort geocoder, GeocodeCacheRepository cacheRepository) {
        this.geocoder = geocoder;
        this.cacheRepository = cacheRepository;
    }

    static String normalizeAddress(String address) {
        return address == null ? "" : address.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Resolve coordinates for an address. Soft-fails: empty on miss or provider error.
     * Successful provider results are cached by normalized address.
     */
    @Transactional
    Optional<GeoCoordinates> resolve(String address) {
        String key = normalizeAddress(address);
        if (key.isEmpty() || key.length() > 255) {
            return Optional.empty();
        }
        Optional<GeocodeCacheEntity> cached = cacheRepository.findById(key);
        if (cached.isPresent()) {
            GeocodeCacheEntity row = cached.get();
            return Optional.of(new GeoCoordinates(row.latitude(), row.longitude()));
        }
        Optional<GeoCoordinates> hit = geocoder.geocode(address.trim());
        hit.ifPresent(
                coords ->
                        cacheRepository.save(
                                new GeocodeCacheEntity(
                                        key, coords.latitude(), coords.longitude(), Instant.now())));
        return hit;
    }
}
