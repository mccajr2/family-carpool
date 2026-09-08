package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GeocodeServiceTest {

    @Mock
    private GeocoderPort geocoder;

    @Mock
    private GeocodeCacheRepository cacheRepository;

    @InjectMocks
    private GeocodeService geocodeService;

    @Test
    void resolveUsesCacheAndSkipsGeocoder() {
        when(cacheRepository.findById("123 main st"))
                .thenReturn(
                        Optional.of(
                                new GeocodeCacheEntity("123 main st", 40.0, -74.0, Instant.now())));

        Optional<GeoCoordinates> result = geocodeService.resolve("  123 Main St  ");

        assertThat(result).contains(new GeoCoordinates(40.0, -74.0));
        verify(geocoder, never()).geocode(any());
    }

    @Test
    void resolveCachesSuccessfulGeocode() {
        when(cacheRepository.findById("park ave")).thenReturn(Optional.empty());
        when(geocoder.geocode("Park Ave"))
                .thenReturn(Optional.of(new GeoCoordinates(41.1, -73.9)));
        when(cacheRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<GeoCoordinates> result = geocodeService.resolve("Park Ave");

        assertThat(result).contains(new GeoCoordinates(41.1, -73.9));
        ArgumentCaptor<GeocodeCacheEntity> cached = ArgumentCaptor.forClass(GeocodeCacheEntity.class);
        verify(cacheRepository).save(cached.capture());
        assertThat(cached.getValue().addressNormalized()).isEqualTo("park ave");
        assertThat(cached.getValue().latitude()).isEqualTo(41.1);
    }

    @Test
    void resolveDoesNotCacheMiss() {
        when(cacheRepository.findById("nowhere")).thenReturn(Optional.empty());
        when(geocoder.geocode("Nowhere")).thenReturn(Optional.empty());

        assertThat(geocodeService.resolve("Nowhere")).isEmpty();
        verify(cacheRepository, never()).save(any());
    }

    @Test
    void findCachedReturnsHitWithoutGeocoder() {
        when(cacheRepository.findById("123 main st"))
                .thenReturn(
                        Optional.of(
                                new GeocodeCacheEntity("123 main st", 40.0, -74.0, Instant.now())));

        Optional<GeoCoordinates> result = geocodeService.findCached("  123 Main St  ");

        assertThat(result).contains(new GeoCoordinates(40.0, -74.0));
        verify(geocoder, never()).geocode(any());
    }

    @Test
    void findCachedMissDoesNotCallGeocoder() {
        when(cacheRepository.findById("nowhere")).thenReturn(Optional.empty());

        assertThat(geocodeService.findCached("Nowhere")).isEmpty();
        verify(geocoder, never()).geocode(any());
        verify(cacheRepository, never()).save(any());
    }

    @Test
    void resolveStripsVenuePrefixBeforeGeocodeAndCacheKey() {
        when(cacheRepository.findById("570 somerville ave somerville ma 02143"))
                .thenReturn(Optional.empty());
        when(geocoder.geocode("570 Somerville Ave Somerville MA 02143"))
                .thenReturn(Optional.of(new GeoCoordinates(42.38, -71.11)));
        when(cacheRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<GeoCoordinates> result =
                geocodeService.resolve(
                        "Veterans Memorial Rink 570 Somerville Ave Somerville MA 02143");

        assertThat(result).contains(new GeoCoordinates(42.38, -71.11));
        verify(geocoder).geocode("570 Somerville Ave Somerville MA 02143");
        ArgumentCaptor<GeocodeCacheEntity> cached = ArgumentCaptor.forClass(GeocodeCacheEntity.class);
        verify(cacheRepository).save(cached.capture());
        assertThat(cached.getValue().addressNormalized())
                .isEqualTo("570 somerville ave somerville ma 02143");
    }

    @Test
    void findCachedUsesStrippedVenueQueryAsCacheKey() {
        when(cacheRepository.findById("975 sandy ln warwick ri 02889"))
                .thenReturn(
                        Optional.of(
                                new GeocodeCacheEntity(
                                        "975 sandy ln warwick ri 02889",
                                        41.7,
                                        -71.4,
                                        Instant.now())));

        Optional<GeoCoordinates> result =
                geocodeService.findCached("Thayer Arena 975 Sandy Ln Warwick RI 02889");

        assertThat(result).contains(new GeoCoordinates(41.7, -71.4));
        verify(geocoder, never()).geocode(any());
    }
}
