package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PickupTownParserTest {

    @Test
    void extractsCityStateBeforeZip() {
        assertThat(PickupTownParser.pickupTownFromAddress("123 Main St, Cambridge, MA 02139"))
                .isEqualTo("Cambridge, MA");
    }

    @Test
    void extractsCityStateWithoutZip() {
        assertThat(PickupTownParser.pickupTownFromAddress("123 Main St, Somerville, MA"))
                .isEqualTo("Somerville, MA");
    }

    @Test
    void extractsCityStateOnlyAddress() {
        assertThat(PickupTownParser.pickupTownFromAddress("Newton, MA")).isEqualTo("Newton, MA");
    }

    @Test
    void prefersLastCityStateSegment() {
        assertThat(
                        PickupTownParser.pickupTownFromAddress(
                                "Office, Cambridge, MA, Boston, MA 02108"))
                .isEqualTo("Boston, MA");
    }

    @Test
    void normalizesStateAbbreviationCase() {
        assertThat(PickupTownParser.pickupTownFromAddress("12 Oak Ln, Medford, ma"))
                .isEqualTo("Medford, MA");
    }

    @Test
    void acceptsDistrictOfColumbia() {
        assertThat(PickupTownParser.pickupTownFromAddress("1600 Pennsylvania Ave, Washington, DC"))
                .isEqualTo("Washington, DC");
    }

    @Test
    void fallsBackToFullTrimmedAddressWhenNoCityState() {
        assertThat(PickupTownParser.pickupTownFromAddress("  12 Oak St  "))
                .isEqualTo("12 Oak St");
    }

    @Test
    void returnsNullForNullOrBlankAddress() {
        assertThat(PickupTownParser.pickupTownFromAddress(null)).isNull();
        assertThat(PickupTownParser.pickupTownFromAddress("")).isNull();
        assertThat(PickupTownParser.pickupTownFromAddress("   ")).isNull();
    }
}
