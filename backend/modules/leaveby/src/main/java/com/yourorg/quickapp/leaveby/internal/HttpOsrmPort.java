package com.yourorg.quickapp.leaveby.internal;

import java.net.URI;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * OSRM route client for PoC driving duration. Soft-fails to empty on any error
 * so the estimate service can apply the configured fallback duration.
 *
 * <p>URI is built with {@link URI#create(String)} so the {@code ;} between
 * coordinate pairs is not treated as a Spring matrix-variable separator (which
 * truncates the path and breaks OSRM).
 */
@Component
@ConditionalOnProperty(
        name = "app.leaveby.osrm.provider",
        havingValue = "http",
        matchIfMissing = true)
class HttpOsrmPort implements OsrmPort {

    private static final Logger log = LoggerFactory.getLogger(HttpOsrmPort.class);
    private static final JsonMapper MAPPER = JsonMapper.shared();

    private final RestClient restClient;
    private final String baseUrl;

    HttpOsrmPort(
            @Value("${app.leaveby.osrm.base-url:https://router.project-osrm.org}") String baseUrl) {
        this.baseUrl = trimTrailingSlash(baseUrl);
        this.restClient = RestClient.builder().baseUrl(this.baseUrl).build();
    }

    @Override
    public Optional<Double> drivingDurationSeconds(
            double fromLat, double fromLng, double toLat, double toLng) {
        URI uri = routeUri(baseUrl, fromLat, fromLng, toLat, toLng);
        try {
            String json = restClient.get().uri(uri).retrieve().body(String.class);
            return parseDurationSeconds(json);
        } catch (Exception ex) {
            Throwable root = ex;
            while (root.getCause() != null && root.getCause() != root) {
                root = root.getCause();
            }
            log.warn(
                    "OSRM route failed; leave-by will use fallback duration: {} ({})",
                    ex.toString(),
                    root.toString());
            return Optional.empty();
        }
    }

    /** Visible for tests — builds the absolute OSRM route URI. */
    static URI routeUri(
            String baseUrl, double fromLat, double fromLng, double toLat, double toLng) {
        String coordinates =
                String.format(
                        Locale.ROOT,
                        "%.6f,%.6f;%.6f,%.6f",
                        fromLng,
                        fromLat,
                        toLng,
                        toLat);
        return URI.create(
                trimTrailingSlash(baseUrl) + "/route/v1/driving/" + coordinates + "?overview=false");
    }

    /** Visible for tests — extracts route duration from an OSRM JSON body. */
    static Optional<Double> parseDurationSeconds(String json) {
        if (json == null || json.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            JsonNode routes = root.get("routes");
            if (routes == null || !routes.isArray() || routes.isEmpty()) {
                return Optional.empty();
            }
            JsonNode duration = routes.get(0).get("duration");
            if (duration == null || !duration.isNumber()) {
                return Optional.empty();
            }
            double seconds = duration.asDouble();
            if (seconds < 0) {
                return Optional.empty();
            }
            return Optional.of(seconds);
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private static String trimTrailingSlash(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://router.project-osrm.org";
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
