package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import org.junit.jupiter.api.Test;

class HttpOsrmPortTest {

    @Test
    void routeUriKeepsSemicolonBetweenCoordinatePairs() {
        URI uri = HttpOsrmPort.routeUri("https://router.project-osrm.org", 40.1, -74.1, 40.2, -74.2);
        assertThat(uri.toString())
                .isEqualTo(
                        "https://router.project-osrm.org/route/v1/driving/-74.100000,40.100000;-74.200000,40.200000?overview=false");
        assertThat(uri.getRawPath()).contains(";");
        assertThat(uri.getRawPath()).doesNotContain("%3B");
    }

    @Test
    void parseDurationSecondsReadsOsrmOkPayload() {
        String json =
                """
                {"code":"Ok","routes":[{"legs":[{"duration":1049.1,"distance":16333.1}],"duration":1049.1,"distance":16333.1}]}
                """;
        assertThat(HttpOsrmPort.parseDurationSeconds(json)).contains(1049.1);
    }

    @Test
    void parseDurationSecondsEmptyOnInvalidQuery() {
        String json = """
                {"code":"InvalidQuery","message":"Number of coordinates needs to be at least two."}
                """;
        assertThat(HttpOsrmPort.parseDurationSeconds(json)).isEmpty();
    }
}
