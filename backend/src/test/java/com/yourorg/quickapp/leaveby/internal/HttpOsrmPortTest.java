package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
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

    @Test
    void drivingDurationSecondsRequestsIdentityEncodingAndReadsJsonBytes() throws Exception {
        AtomicReference<String> acceptEncoding = new AtomicReference<>();
        byte[] payload =
                """
                {"code":"Ok","routes":[{"duration":321.5,"distance":1000}]}
                """
                        .getBytes(StandardCharsets.UTF_8);

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    acceptEncoding.set(exchange.getRequestHeaders().getFirst("Accept-Encoding"));
                    exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
                    exchange.sendResponseHeaders(200, payload.length);
                    exchange.getResponseBody().write(payload);
                    exchange.close();
                });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            HttpOsrmPort port = new HttpOsrmPort(baseUrl);
            assertThat(port.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2)).contains(321.5);
            assertThat(acceptEncoding.get()).isEqualTo("identity");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void drivingDurationSecondsSoftFailsWhenUpstreamExceedsReadTimeout() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    try {
                        Thread.sleep(HttpOsrmPort.READ_TIMEOUT.toMillis() + 2_000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    byte[] payload = "{\"code\":\"Ok\",\"routes\":[{\"duration\":1}]}".getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, payload.length);
                    exchange.getResponseBody().write(payload);
                    exchange.close();
                });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            HttpOsrmPort port = new HttpOsrmPort(baseUrl);
            long started = System.nanoTime();
            assertThat(port.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2)).isEmpty();
            long elapsedMs = (System.nanoTime() - started) / 1_000_000L;
            assertThat(elapsedMs).isLessThan(HttpOsrmPort.READ_TIMEOUT.toMillis() + 2_500);
        } finally {
            server.stop(0);
        }
    }
}
