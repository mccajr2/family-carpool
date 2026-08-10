package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NominatimGeocoderPortTest {

    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> lastUserAgent = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/search",
                exchange -> {
                    lastUserAgent.set(exchange.getRequestHeaders().getFirst("User-Agent"));
                    byte[] body =
                            """
                            [{"lat":"40.7128","lon":"-74.0060"}]
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void geocodeParsesHitAndSendsUserAgent() {
        NominatimGeocoderPort port =
                new NominatimGeocoderPort(baseUrl, "family-carpool-test/0.1", 0);

        Optional<GeoCoordinates> coords = port.geocode("123 Main St");

        assertThat(coords).contains(new GeoCoordinates(40.7128, -74.0060));
        assertThat(lastUserAgent.get()).isEqualTo("family-carpool-test/0.1");
    }

    @Test
    void geocodeSoftFailsOnEmptyBody() throws IOException {
        server.stop(0);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/search",
                exchange -> {
                    byte[] body = "[]".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();

        NominatimGeocoderPort port =
                new NominatimGeocoderPort(baseUrl, "family-carpool-test/0.1", 0);

        assertThat(port.geocode("Nowhere")).isEmpty();
    }
}
