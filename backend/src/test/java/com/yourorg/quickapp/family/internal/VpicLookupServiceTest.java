package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VpicLookupServiceTest {

    @Mock
    private VpicPort vpicPort;

    @Mock
    private VpicSeatCacheRepository cache;

    @InjectMocks
    private VpicLookupService lookup;

    @Test
    void suggestSeatsUsesCacheAndSkipsPort() {
        when(cache.findById(new VpicSeatCacheEntity.Key("honda", "odyssey", 2020)))
                .thenReturn(
                        Optional.of(
                                new VpicSeatCacheEntity(
                                        "honda", "odyssey", 2020, 8, Instant.now())));

        assertThat(lookup.suggestSeats(2020, "Honda", "Odyssey")).contains(8);
        verify(vpicPort, never()).suggestSeats(anyInt(), any(), any());
    }

    @Test
    void suggestSeatsCachesSuccessfulHint() {
        when(cache.findById(any())).thenReturn(Optional.empty());
        when(vpicPort.suggestSeats(2020, "Honda", "Odyssey")).thenReturn(Optional.of(8));
        when(cache.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(lookup.suggestSeats(2020, "Honda", "Odyssey")).contains(8);
        verify(cache).save(any(VpicSeatCacheEntity.class));
    }

    @Test
    void suggestSeatsDoesNotCacheMiss() {
        when(cache.findById(any())).thenReturn(Optional.empty());
        when(vpicPort.suggestSeats(2020, "Honda", "Mystery")).thenReturn(Optional.empty());

        assertThat(lookup.suggestSeats(2020, "Honda", "Mystery")).isEmpty();
        verify(cache, never()).save(any());
    }
}
