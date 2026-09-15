package com.yourorg.quickapp.leaveby;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.family.internal.StubGeocoderPort;
import com.yourorg.quickapp.leaveby.internal.StubOsrmPort;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Integration: optimize-on-build, manual reorder under the same fingerprint, and
 * fingerprint rebuild clearing the manual order (stub geocode + OSRM).
 */
@SpringBootTest
@AutoConfigureMockMvc
class LeaveByRouteOptimizeIntegrationTest {

    private static final String NEAR_PICKUP = "N";
    private static final String FAR_PICKUP = "Faraway Boulevard Extension Way XX";
    private static final String DESTINATION = "Allied Veterans Rink Everett";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LeaveByApi leaveByApi;

    @Autowired
    private StubGeocoderPort stubGeocoder;

    @Autowired
    private StubOsrmPort stubOsrm;

    @Test
    void optimizeOnBuildReorderThenFingerprintRebuildClearsManual() throws Exception {
        String token = signIn("leaveby-route-optimize@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidId = JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/places")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Mom's house\",\"address\":\"1 Main Street\"}"))
                .andExpect(status().isCreated());

        MvcResult circle =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                        .andExpect(status().isOk())
                        .andReturn();
        String adultIdRaw =
                JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");
        UUID adultId = UUID.fromString(adultIdRaw);

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Tuesday Practice\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"location\":\""
                                                        + DESTINATION
                                                        + "\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        UUID itemId =
                UUID.fromString(
                        JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id"));

        int geocodeBefore = stubGeocoder.httpCallCount();
        int osrmBefore = stubOsrm.httpCallCount();

        // Bad input order: far pickup first. Stub coords make near cheaper from home.
        CalendarRouteDto built =
                leaveByApi.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput("Far kid", FAR_PICKUP),
                                new CalendarRoutePickupInput("Near kid", NEAR_PICKUP)),
                        DESTINATION,
                        DESTINATION);

        assertThat(built.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(built.stops()).hasSize(4);
        assertThat(built.stops().get(0).kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(built.stops().get(3).kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
        List<String> optimizedPickups =
                built.stops().stream()
                        .filter(stop -> stop.kind() == CalendarRouteStopKind.PICKUP)
                        .map(CalendarRouteStopDto::address)
                        .toList();
        assertThat(optimizedPickups).containsExactly(NEAR_PICKUP, FAR_PICKUP);
        assertThat(pathSeconds(built)).isLessThan(pathSecondsForOrder(List.of(FAR_PICKUP, NEAR_PICKUP)));
        assertThat(stubGeocoder.httpCallCount()).isGreaterThan(geocodeBefore);
        assertThat(stubOsrm.httpCallCount()).isGreaterThan(osrmBefore);

        CalendarRouteDto reordered =
                leaveByApi.reorderCalendarRouteMiddles(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        List.of(FAR_PICKUP, NEAR_PICKUP));
        assertThat(reordered.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(reordered.stops().get(1).address()).isEqualTo(FAR_PICKUP);
        assertThat(reordered.stops().get(2).address()).isEqualTo(NEAR_PICKUP);

        // Same fingerprint → cached manual order kept.
        CalendarRouteDto cached =
                leaveByApi.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput("Far kid", FAR_PICKUP),
                                new CalendarRoutePickupInput("Near kid", NEAR_PICKUP)),
                        DESTINATION,
                        DESTINATION);
        assertThat(cached.stops().get(1).address()).isEqualTo(FAR_PICKUP);
        assertThat(cached.stops().get(2).address()).isEqualTo(NEAR_PICKUP);

        // Destination change busts fingerprint → fresh auto-optimize clears manual.
        String newDestination = DESTINATION + " North";
        CalendarRouteDto rebuilt =
                leaveByApi.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput("Far kid", FAR_PICKUP),
                                new CalendarRoutePickupInput("Near kid", NEAR_PICKUP)),
                        newDestination,
                        newDestination);
        assertThat(rebuilt.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(rebuilt.stops().get(1).address()).isEqualTo(NEAR_PICKUP);
        assertThat(rebuilt.stops().get(2).address()).isEqualTo(FAR_PICKUP);
        assertThat(rebuilt.stops().get(3).address()).isEqualTo(newDestination);
    }

    private static double pathSeconds(CalendarRouteDto route) {
        // legMinutes are rounded; rebuild expected seconds from stub coords instead.
        return pathSecondsForOrder(
                route.stops().stream()
                        .filter(stop -> stop.kind() == CalendarRouteStopKind.PICKUP)
                        .map(CalendarRouteStopDto::address)
                        .toList());
    }

    private static double pathSecondsForOrder(List<String> pickupAddresses) {
        double homeLat = stubCoordLat("1 Main Street");
        double homeLng = stubCoordLng("1 Main Street");
        double destLat = stubCoordLat(DESTINATION);
        double destLng = stubCoordLng(DESTINATION);
        double total = 0;
        double fromLat = homeLat;
        double fromLng = homeLng;
        for (String pickup : pickupAddresses) {
            double toLat = stubCoordLat(pickup);
            double toLng = stubCoordLng(pickup);
            total +=
                    StubOsrmPort.drivingDurationSecondsForCoords(fromLat, fromLng, toLat, toLng);
            fromLat = toLat;
            fromLng = toLng;
        }
        total +=
                StubOsrmPort.drivingDurationSecondsForCoords(fromLat, fromLng, destLat, destLng);
        return total;
    }

    private static double stubCoordLat(String address) {
        return 40.0 + (address.trim().length() % 100) / 1000.0;
    }

    private static double stubCoordLng(String address) {
        return -74.0 - (address.trim().length() % 100) / 1000.0;
    }

    private String signIn(String email) throws Exception {
        MvcResult requestResult =
                mockMvc.perform(
                                post("/api/auth/request-code")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"email\":\"" + email + "\"}"))
                        .andExpect(status().isAccepted())
                        .andReturn();
        String code = JsonPath.read(requestResult.getResponse().getContentAsString(), "$.devCode");
        MvcResult verifyResult =
                mockMvc.perform(
                                post("/api/auth/verify-code")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"email\":\""
                                                        + email
                                                        + "\",\"code\":\""
                                                        + code
                                                        + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        return JsonPath.read(verifyResult.getResponse().getContentAsString(), "$.accessToken");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
