package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.leaveby.internal.StubOsrmPort;
import java.util.List;
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

@SpringBootTest
@AutoConfigureMockMvc
class CarpoolRideDetourIntegrationTest {

    private static final String FROM = "2026-08-01T00:00:00Z";
    private static final String TO = "2026-09-01T00:00:00Z";
    private static final String EVENT_KEY = "UID:stub-game-1@example.com";
    private static final String PICKUP_ADDRESS = "12 Oak St, Cambridge, MA 02139";
    private static final String VIEWER_ORIGIN = "100 Main St, Somerville, MA";
    private static final String EVENT_LOCATION = "Field 3";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void listCarpoolRidesReturnsPickupTownAndViewerDetourMinutes() throws Exception {
        String orgA = signIn("carpool-detour-org-a@example.com");
        String orgB = signIn("carpool-detour-org-b@example.com");

        createCircle(orgA, "Alex", "Detour House A");
        createCircle(orgB, "Sam", "Detour House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(orgA, "Soccer", "https://example.com/carpool-detour.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-detour.ics", kidB);

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedA + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String code = JsonPath.read(enabled.getResponse().getContentAsString(), "$.inviteCode");
        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());

        setRsvpYes(orgA, feedEventId(orgA, "Practice"), kidA);
        setRsvpYes(orgB, feedEventId(orgB, "Practice"), kidB);
        addPlace(orgA, "Home A", PICKUP_ADDRESS);
        addPlace(orgB, "Home B", VIEWER_ORIGIN);

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pickupAddress").value(PICKUP_ADDRESS))
                .andExpect(jsonPath("$.pickupTown").value("Cambridge, MA"))
                .andExpect(jsonPath("$.detourMinutes").value(nullValue()));

        int expectedDetour =
                expectedDetourMinutes(VIEWER_ORIGIN, PICKUP_ADDRESS, EVENT_LOCATION);
        assertThat(expectedDetour).isGreaterThan(0);

        MvcResult orgBList =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        String orgBJson = orgBList.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> pickupTowns =
                JsonPath.read(orgBJson, eventFilter() + ".otherRequests[0].pickupTown");
        assertThat(pickupTowns).containsExactly("Cambridge, MA");
        @SuppressWarnings("unchecked")
        List<Integer> detourMinutesList =
                JsonPath.read(orgBJson, eventFilter() + ".otherRequests[0].detourMinutes");
        assertThat(detourMinutesList).containsExactly(expectedDetour);

        MvcResult orgAList =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        String orgAJson = orgAList.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> ownPickupTowns =
                JsonPath.read(orgAJson, eventFilter() + ".ownRequest.pickupTown");
        assertThat(ownPickupTowns).containsExactly("Cambridge, MA");
        @SuppressWarnings("unchecked")
        List<Integer> ownDetours =
                JsonPath.read(orgAJson, eventFilter() + ".ownRequest.detourMinutes");
        assertThat(ownDetours).containsExactly((Integer) null);
    }

    @Test
    void listCarpoolRidesSoftFailsDetourWhenViewerHasNoLocatedOrigin() throws Exception {
        String orgA = signIn("carpool-detour-miss-org-a@example.com");
        String orgB = signIn("carpool-detour-miss-org-b@example.com");

        createCircle(orgA, "Alex", "Detour Miss House A");
        createCircle(orgB, "Sam", "Detour Miss House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(
                        orgA, "Soccer", "https://example.com/carpool-detour-miss.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-detour-miss.ics", kidB);

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedA + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String code = JsonPath.read(enabled.getResponse().getContentAsString(), "$.inviteCode");
        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());

        setRsvpYes(orgA, feedEventId(orgA, "Practice"), kidA);
        setRsvpYes(orgB, feedEventId(orgB, "Practice"), kidB);
        addPlace(orgA, "Home A", PICKUP_ADDRESS);
        addPlace(orgB, "Home B", "Unlocateable Lane");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                .andExpect(status().isCreated());

        MvcResult listed =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        String json = listed.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> towns =
                JsonPath.read(json, eventFilter() + ".otherRequests[0].pickupTown");
        assertThat(towns).containsExactly("Cambridge, MA");
        @SuppressWarnings("unchecked")
        List<Integer> detours =
                JsonPath.read(json, eventFilter() + ".otherRequests[0].detourMinutes");
        assertThat(detours).containsExactly((Integer) null);
    }

    private static String eventFilter() {
        return "$.[?(@.eventKey=='" + EVENT_KEY + "')]";
    }

    private static int expectedDetourMinutes(
            String originAddress, String pickupAddress, String eventLocation) {
        double[] origin = stubGeocode(originAddress);
        double[] pickup = stubGeocode(pickupAddress);
        double[] event = stubGeocode(eventLocation);
        double direct =
                StubOsrmPort.drivingDurationSecondsForCoords(
                        origin[0], origin[1], event[0], event[1]);
        double originToPickup =
                StubOsrmPort.drivingDurationSecondsForCoords(
                        origin[0], origin[1], pickup[0], pickup[1]);
        double pickupToEvent =
                StubOsrmPort.drivingDurationSecondsForCoords(
                        pickup[0], pickup[1], event[0], event[1]);
        double deltaSeconds = originToPickup + pickupToEvent - direct;
        return Math.max(0, (int) Math.round(deltaSeconds / 60.0));
    }

    private static double[] stubGeocode(String address) {
        int len = address.trim().length() % 100;
        return new double[] {40.0 + len / 1000.0, -74.0 - len / 1000.0};
    }

    private String feedEventId(String token, String title) throws Exception {
        MvcResult calendar =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> ids =
                JsonPath.read(
                        calendar.getResponse().getContentAsString(),
                        "$.[?(@.title=='" + title + "')].id");
        assertThat(ids).isNotEmpty();
        return ids.getFirst();
    }

    private void setRsvpYes(String token, String itemId, String kidId) throws Exception {
        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + itemId + "/rsvps/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"YES\"}"))
                .andExpect(status().isOk());
    }

    private void createCircle(String token, String displayName, String name) throws Exception {
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\""
                                                + displayName
                                                + "\",\"name\":\""
                                                + name
                                                + "\"}"))
                .andExpect(status().isCreated());
    }

    private String addKid(String token, String displayName) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"" + displayName + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }

    private String createFeed(String token, String name, String url, String kidId) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"sourceUrl\":\""
                                                        + url
                                                        + "\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }

    private void addPlace(String token, String name, String address) throws Exception {
        mockMvc.perform(
                        post("/api/family/circle/places")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\""
                                                + name
                                                + "\",\"address\":\""
                                                + address
                                                + "\"}"))
                .andExpect(status().isCreated());
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
