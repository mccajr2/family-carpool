package com.yourorg.quickapp.leaveby.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * OSRM table/route client for PoC driving duration. Soft-fails to empty on any
 * error so the estimate service can apply the configured fallback duration.
 */
@Component
@ConditionalOnProperty(
        name = "app.leaveby.osrm.provider",
        havingValue = "http",
        matchIfMissing = true)
class HttpOsrmPort implements OsrmPort {

    private static final Logger log = LoggerFactory.getLogger(HttpOsrmPort.class);

    private final RestClient restClient;

    HttpOsrmPort(
            @Value("${app.leaveby.osrm.base-url:https://router.project-osrm.org}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public Optional<Double> drivingDurationSeconds(
            double fromLat, double fromLng, double toLat, double toLng) {
        String coordinates =
                fromLng + "," + fromLat + ";" + toLng + "," + toLat;
        try {
            OsrmRouteResponse body =
                    restClient
                            .get()
                            .uri(
                                    uriBuilder ->
                                            uriBuilder
                                                    .path("/route/v1/driving/{coordinates}")
                                                    .queryParam("overview", "false")
                                                    .build(coordinates))
                            .retrieve()
                            .body(OsrmRouteResponse.class);
            if (body == null || body.routes() == null || body.routes().isEmpty()) {
                return Optional.empty();
            }
            Double duration = body.routes().getFirst().duration();
            if (duration == null || duration < 0) {
                return Optional.empty();
            }
            return Optional.of(duration);
        } catch (Exception ex) {
            log.warn("OSRM route failed; leave-by will use fallback duration: {}", ex.toString());
            return Optional.empty();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record OsrmRouteResponse(List<OsrmRoute> routes) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record OsrmRoute(Double duration) {}
}
