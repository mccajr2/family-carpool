package com.yourorg.quickapp.family.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@ConditionalOnProperty(name = "app.geocode.provider", havingValue = "nominatim", matchIfMissing = true)
class NominatimGeocoderPort implements GeocoderPort {

    private static final Logger log = LoggerFactory.getLogger(NominatimGeocoderPort.class);

    private final RestClient restClient;
    private final String userAgent;
    private final long minIntervalMs;
    private final Object rateLock = new Object();
    private long lastCallEpochMs;

    NominatimGeocoderPort(
            RestClient.Builder restClientBuilder,
            @Value("${app.geocode.nominatim-base-url:https://nominatim.openstreetmap.org}")
                    String baseUrl,
            @Value("${app.geocode.user-agent:family-carpool/0.1 (dev; contact@example.com)}")
                    String userAgent,
            @Value("${app.geocode.min-interval-ms:1000}") long minIntervalMs) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.userAgent = userAgent;
        this.minIntervalMs = Math.max(0, minIntervalMs);
    }

    @Override
    public Optional<GeoCoordinates> geocode(String address) {
        if (address == null || address.isBlank()) {
            return Optional.empty();
        }
        throttle();
        try {
            NominatimHit[] hits =
                    restClient
                            .get()
                            .uri(
                                    uriBuilder ->
                                            uriBuilder
                                                    .path("/search")
                                                    .queryParam("q", address)
                                                    .queryParam("format", "json")
                                                    .queryParam("limit", "1")
                                                    .build())
                            .header("User-Agent", userAgent)
                            .retrieve()
                            .body(NominatimHit[].class);
            if (hits == null || hits.length == 0) {
                return Optional.empty();
            }
            NominatimHit hit = hits[0];
            if (hit.lat() == null || hit.lon() == null) {
                return Optional.empty();
            }
            return Optional.of(
                    new GeoCoordinates(Double.parseDouble(hit.lat()), Double.parseDouble(hit.lon())));
        } catch (Exception ex) {
            log.warn("Nominatim geocode failed for address: {}", ex.toString());
            return Optional.empty();
        }
    }

    private void throttle() {
        if (minIntervalMs <= 0) {
            return;
        }
        synchronized (rateLock) {
            long now = System.currentTimeMillis();
            long wait = lastCallEpochMs + minIntervalMs - now;
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            lastCallEpochMs = System.currentTimeMillis();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record NominatimHit(String lat, String lon) {}
}
