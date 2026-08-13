package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.FamilyGeocodeApi;
import com.yourorg.quickapp.family.GeoPointDto;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class FamilyGeocodeApiImpl implements FamilyGeocodeApi {

    private final GeocodeService geocodeService;

    FamilyGeocodeApiImpl(GeocodeService geocodeService) {
        this.geocodeService = geocodeService;
    }

    @Override
    public Optional<GeoPointDto> resolveLocation(String locationText) {
        return geocodeService
                .resolve(locationText)
                .map(coords -> new GeoPointDto(coords.latitude(), coords.longitude()));
    }

    @Override
    public Optional<GeoPointDto> findCachedLocation(String locationText) {
        return geocodeService
                .findCached(locationText)
                .map(coords -> new GeoPointDto(coords.latitude(), coords.longitude()));
    }
}
