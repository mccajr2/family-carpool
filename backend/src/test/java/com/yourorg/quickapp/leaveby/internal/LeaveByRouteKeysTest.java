package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LeaveByRouteKeysTest {

    @Test
    void routeKeyMatchesOsrmLngLatSemicolonFormat() {
        assertThat(LeaveByRouteKeys.routeKey(40.1, -74.1, 40.2, -74.2))
                .isEqualTo("-74.100000,40.100000;-74.200000,40.200000");
    }
}
