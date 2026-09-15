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

    @Test
    void softSkippedPickupsStayWithinVarchar64AndBustCache() {
        UUID placeId = UUID.fromString("01900000-0000-7000-8000-000000000031");
        String base =
                ItineraryFingerprint.compute(
                        placeId,
                        40.1,
                        -74.1,
                        "1 Main",
                        List.of("bad addr", "12 Oak"),
                        "Rink");
        String soft = ItineraryFingerprint.withSoftSkippedPickups(base, 1, 2);
        String recovered = ItineraryFingerprint.withSoftSkippedPickups(base, 2, 2);
        assertThat(soft).hasSize(64);
        assertThat(soft).isNotEqualTo(base);
        assertThat(recovered).isEqualTo(base);
        // Legacy append would be 64 + ":geo:1/2" and overflow the column.
        assertThat(base + ":geo:1/2").hasSizeGreaterThan(64);
    }
}
