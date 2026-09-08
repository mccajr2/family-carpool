package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GeocodeAddressQueryTest {

    @Test
    void stripsLeadingVenueBeforeHouseNumber() {
        assertThat(
                        GeocodeAddressQuery.forGeocode(
                                "Veterans Memorial Rink 570 Somerville Ave Somerville MA 02143"))
                .isEqualTo("570 Somerville Ave Somerville MA 02143");
        assertThat(GeocodeAddressQuery.forGeocode("Thayer Arena 975 Sandy Ln Warwick RI 02889"))
                .isEqualTo("975 Sandy Ln Warwick RI 02889");
    }

    @Test
    void leavesStreetOnlyAddressesUnchanged() {
        assertThat(GeocodeAddressQuery.forGeocode("570 Somerville Ave, Somerville, MA 02143"))
                .isEqualTo("570 Somerville Ave, Somerville, MA 02143");
        assertThat(GeocodeAddressQuery.forGeocode("  123 Main St  ")).isEqualTo("123 Main St");
    }

    @Test
    void leavesVenueOnlyWithoutHouseNumberUnchanged() {
        assertThat(GeocodeAddressQuery.forGeocode("Veterans Memorial Rink"))
                .isEqualTo("Veterans Memorial Rink");
        assertThat(GeocodeAddressQuery.forGeocode("Crossbar Complex Field 2"))
                .isEqualTo("Crossbar Complex Field 2");
        assertThat(GeocodeAddressQuery.forGeocode("Dome")).isEqualTo("Dome");
    }

    @Test
    void nullAndBlank() {
        assertThat(GeocodeAddressQuery.forGeocode(null)).isEmpty();
        assertThat(GeocodeAddressQuery.forGeocode("   ")).isEmpty();
    }
}
