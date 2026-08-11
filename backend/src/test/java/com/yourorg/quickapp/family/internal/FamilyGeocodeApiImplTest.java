package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.family.GeoPointDto;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FamilyGeocodeApiImplTest {

    @Mock
    private GeocodeService geocodeService;

    @InjectMocks
    private FamilyGeocodeApiImpl api;

    @Test
    void resolveLocationMapsCoordinates() {
        when(geocodeService.resolve("Veterans Memorial Rink"))
                .thenReturn(Optional.of(new GeoCoordinates(42.38, -71.1)));

        Optional<GeoPointDto> result = api.resolveLocation("Veterans Memorial Rink");

        assertThat(result).contains(new GeoPointDto(42.38, -71.1));
        verify(geocodeService).resolve("Veterans Memorial Rink");
    }

    @Test
    void resolveLocationSoftFails() {
        when(geocodeService.resolve("")).thenReturn(Optional.empty());

        assertThat(api.resolveLocation("")).isEmpty();
    }
}
