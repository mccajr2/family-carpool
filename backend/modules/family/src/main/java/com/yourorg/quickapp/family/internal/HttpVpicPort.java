package com.yourorg.quickapp.family.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@ConditionalOnProperty(name = "app.vpic.provider", havingValue = "http", matchIfMissing = true)
class HttpVpicPort implements VpicPort {

    private static final Logger log = LoggerFactory.getLogger(HttpVpicPort.class);
    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    static final Duration READ_TIMEOUT = Duration.ofSeconds(8);
    private static final int MAX_WMI_DECODES = 6;

    private final RestClient restClient;
    private final String userAgent;
    private final long minIntervalMs;
    private final Object rateLock = new Object();
    private long lastCallEpochMs;

    HttpVpicPort(
            @Value("${app.vpic.base-url:https://vpic.nhtsa.dot.gov/api}") String baseUrl,
            @Value(
                            "${app.vpic.user-agent:family-carpool/0.1 (https://github.com/mccajr2/family-carpool)}")
                    String userAgent,
            @Value("${app.vpic.min-interval-ms:200}") long minIntervalMs) {
        this.userAgent = userAgent;
        this.minIntervalMs = Math.max(0, minIntervalMs);
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(
                        HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build());
        requestFactory.setReadTimeout(READ_TIMEOUT);
        this.restClient =
                RestClient.builder()
                        .baseUrl(baseUrl)
                        .requestFactory(requestFactory)
                        .defaultHeader("User-Agent", userAgent)
                        .build();
    }

    @Override
    public List<String> listMakes() {
        throttle();
        try {
            VpicListResponse response =
                    restClient
                            .get()
                            .uri("/vehicles/GetAllMakes?format=json")
                            .retrieve()
                            .body(VpicListResponse.class);
            if (response == null || response.results() == null) {
                return List.of();
            }
            return response.results().stream()
                    .map(VpicNamed::makeName)
                    .filter(name -> name != null && !name.isBlank())
                    .distinct()
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
        } catch (Exception ex) {
            log.warn("vPIC GetAllMakes failed: {}", ex.toString());
            return List.of();
        }
    }

    @Override
    public List<String> listModels(String make, int year) {
        if (make == null || make.isBlank()) {
            return List.of();
        }
        throttle();
        try {
            VpicListResponse response =
                    restClient
                            .get()
                            .uri(
                                    "/vehicles/GetModelsForMakeYear/make/{make}/modelyear/{year}?format=json",
                                    make.trim(),
                                    year)
                            .retrieve()
                            .body(VpicListResponse.class);
            if (response == null || response.results() == null) {
                return List.of();
            }
            return response.results().stream()
                    .map(VpicNamed::modelName)
                    .filter(name -> name != null && !name.isBlank())
                    .distinct()
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
        } catch (Exception ex) {
            log.warn("vPIC GetModelsForMakeYear failed: {}", ex.toString());
            return List.of();
        }
    }

    @Override
    public Optional<Integer> suggestSeats(int year, String make, String model) {
        if (make == null || model == null || make.isBlank() || model.isBlank()) {
            return Optional.empty();
        }
        String wantModel = model.trim();
        List<String> wmis = passengerWmis(make.trim());
        Map<Integer, Integer> counts = new HashMap<>();
        for (String wmi : wmis) {
            Optional<Integer> seats = decodeSeats(wmi, year, wantModel);
            seats.ifPresent(value -> counts.merge(value, 1, Integer::sum));
        }
        return counts.entrySet().stream()
                .filter(e -> e.getKey() >= 2 && e.getKey() <= 18)
                .max(Comparator.<Map.Entry<Integer, Integer>>comparingInt(Map.Entry::getValue)
                        .thenComparingInt(Map.Entry::getKey))
                .map(Map.Entry::getKey);
    }

    private List<String> passengerWmis(String make) {
        throttle();
        try {
            VpicWmiResponse response =
                    restClient
                            .get()
                            .uri("/vehicles/GetWMIsForManufacturer/{make}?format=json", make)
                            .retrieve()
                            .body(VpicWmiResponse.class);
            if (response == null || response.results() == null) {
                return List.of();
            }
            List<VpicWmi> preferred = new ArrayList<>();
            List<VpicWmi> other = new ArrayList<>();
            for (VpicWmi row : response.results()) {
                if (row.wmi() == null || row.wmi().isBlank()) {
                    continue;
                }
                String type = row.vehicleType() == null ? "" : row.vehicleType().toLowerCase(Locale.ROOT);
                if (type.contains("motorcycle") || type.contains("trailer") || type.contains("bus")) {
                    continue;
                }
                if (type.contains("passenger") || type.contains("mpv") || type.contains("truck")) {
                    preferred.add(row);
                } else {
                    other.add(row);
                }
            }
            List<String> wmis = new ArrayList<>();
            for (VpicWmi row : preferred) {
                if (wmis.size() >= MAX_WMI_DECODES) {
                    break;
                }
                if (!wmis.contains(row.wmi())) {
                    wmis.add(row.wmi());
                }
            }
            for (VpicWmi row : other) {
                if (wmis.size() >= MAX_WMI_DECODES) {
                    break;
                }
                if (!wmis.contains(row.wmi())) {
                    wmis.add(row.wmi());
                }
            }
            return wmis;
        } catch (Exception ex) {
            log.warn("vPIC GetWMIsForManufacturer failed: {}", ex.toString());
            return List.of();
        }
    }

    private Optional<Integer> decodeSeats(String wmi, int year, String wantModel) {
        String partial = (wmi + "**************").substring(0, 17);
        throttle();
        try {
            VpicDecodeResponse response =
                    restClient
                            .get()
                            .uri(
                                    "/vehicles/DecodeVinValues/{vin}?format=json&modelyear={year}",
                                    partial,
                                    year)
                            .retrieve()
                            .body(VpicDecodeResponse.class);
            if (response == null || response.results() == null || response.results().isEmpty()) {
                return Optional.empty();
            }
            VpicDecode row = response.results().getFirst();
            if (row.model() == null
                    || !row.model().equalsIgnoreCase(wantModel) && !row.model().toLowerCase(Locale.ROOT)
                            .contains(wantModel.toLowerCase(Locale.ROOT))) {
                return Optional.empty();
            }
            if (row.seats() == null || row.seats().isBlank()) {
                return Optional.empty();
            }
            int seats = Integer.parseInt(row.seats().trim());
            if (seats < 2 || seats > 18) {
                return Optional.empty();
            }
            return Optional.of(seats);
        } catch (Exception ex) {
            log.warn("vPIC DecodeVinValues failed: {}", ex.toString());
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
    private record VpicListResponse(@JsonProperty("Results") List<VpicNamed> results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VpicNamed(
            @JsonProperty("Make_Name") String makeName, @JsonProperty("Model_Name") String modelName) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VpicWmiResponse(@JsonProperty("Results") List<VpicWmi> results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VpicWmi(
            @JsonProperty("WMI") String wmi, @JsonProperty("VehicleType") String vehicleType) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VpicDecodeResponse(@JsonProperty("Results") List<VpicDecode> results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VpicDecode(
            @JsonProperty("Model") String model, @JsonProperty("Seats") String seats) {}
}
