package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ItineraryFingerprintTest {

    @Test
    void normalizesAddressesAndIsStable() {
        UUID placeId = UUID.fromString("01900000-0000-7000-8000-000000000031");
        String a =
                ItineraryFingerprint.compute(
                        placeId, 40.1, -74.1, "1 Main St", List.of("12 Oak St"), "65 Elm St");
        String b =
                ItineraryFingerprint.compute(
                        placeId, 40.1, -74.1, " 1 MAIN ST ", List.of(" 12 oak st "), " 65 elm st ");
        assertThat(a).isEqualTo(b);
        assertThat(a).hasSize(64);
    }

    @Test
    void changesWhenOriginCoordsOrPickupChange() {
        UUID placeId = UUID.fromString("01900000-0000-7000-8000-000000000031");
        String base =
                ItineraryFingerprint.compute(
                        placeId, 40.1, -74.1, "1 Main", List.of("12 Oak"), "Rink");
        assertThat(
                        ItineraryFingerprint.compute(
                                placeId, 40.100001, -74.1, "1 Main", List.of("12 Oak"), "Rink"))
                .isNotEqualTo(base);
        assertThat(
                        ItineraryFingerprint.compute(
                                placeId, 40.1, -74.1, "1 Main", List.of("99 Pine"), "Rink"))
                .isNotEqualTo(base);
    }
}
