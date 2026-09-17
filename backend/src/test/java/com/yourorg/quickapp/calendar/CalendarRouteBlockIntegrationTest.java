package com.yourorg.quickapp.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
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

/**
 * Block multi-stop route: combined TO assembly, FROM dropoffs, member-set
 * equivalence across itemIds, and leg-scoped reorder.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CalendarRouteBlockIntegrationTest {

    private static final String FROM = "2026-08-01T00:00:00Z";
    private static final String TO = "2026-09-01T00:00:00Z";
    private static final String FEED_URL = "https://example.com/drive-block-route.ics";
    private static final String EVENT_A = "UID:stub-drive-block-a@example.com";
    private static final String EVENT_B = "UID:stub-drive-block-b@example.com";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void combinedBlockRouteSameViaEitherItemId_fromDropoff_andReorder() throws Exception {
        String driver = signIn("drive-block-route-driver@example.com");
        String requester = signIn("drive-block-route-requester@example.com");

        createCircle(driver, "Alex", "House Driver");
        createCircle(requester, "Sam", "House Requester");

        String driverKid = addKid(driver, "Riley");
        String requesterKid = addKid(requester, "Sam");
        String feedDriver = createFeed(driver, "Hockey", FEED_URL, driverKid);
        createFeed(requester, "Hockey", FEED_URL, requesterKid);

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedDriver + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String code = JsonPath.read(enabled.getResponse().getContentAsString(), "$.inviteCode");
        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());

        String practiceA = feedEventId(driver, "Practice A");
        String practiceB = feedEventId(driver, "Practice B");
        String practiceARequester = feedEventId(requester, "Practice A");
        String practiceBRequester = feedEventId(requester, "Practice B");
        setRsvpYes(driver, practiceA, driverKid);
        setRsvpYes(driver, practiceB, driverKid);
        setRsvpYes(requester, practiceARequester, requesterKid);
        setRsvpYes(requester, practiceBRequester, requesterKid);
        addPlace(driver, "Home A", "12 Oak St");
        String schoolId = addPlaceReturningId(driver, "School", "2 School Rd");
        addPlace(requester, "Home B", "34 Pine St");

        String driverAdultId = organizerAdultId(driver);
        assertThat(driverAdultId).isNotBlank();

        // Warm geocode so venues share identity for block merge.
        mockMvc.perform(
                        get("/api/family/circle/calendar/leave-by")
                                .param("from", FROM)
                                .param("to", TO)
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk());

        acceptRide(driver, requester, spaceId, EVENT_A);
        acceptRide(driver, requester, spaceId, EVENT_B);

        // Household leave-from (school) + teammate home → 2 distinct TO middles.
        assignCoverageLeaveFrom(driver, practiceA, driverAdultId, driverKid, schoolId);
        assignCoverageLeaveFrom(driver, practiceB, driverAdultId, driverKid, schoolId);

        MvcResult viaA =
                mockMvc.perform(
                                get("/api/family/circle/calendar/FEED/" + practiceA + "/route")
                                        .param("leg", "TO")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                        .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.leg").value("TO"))
                .andExpect(jsonPath("$.memberItemIds", hasSize(2)))
                .andExpect(jsonPath("$.stops[0].kind").value("home"))
                .andExpect(jsonPath("$.stops[0].address").value("12 Oak St"))
                .andExpect(jsonPath("$.stops[-1].kind").value("destination"))
                .andExpect(jsonPath("$.stops[*].kind", hasItem("pickup")))
                .andReturn();
        String toJsonA = viaA.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> memberIdsA =
                JsonPath.read(toJsonA, "$.memberItemIds[*].itemId");
        assertThat(memberIdsA).containsExactlyInAnyOrder(practiceA, practiceB);
        @SuppressWarnings("unchecked")
        List<String> middleAddressesA =
                JsonPath.read(toJsonA, "$.stops[?(@.kind=='pickup')].address");
        assertThat(middleAddressesA).contains("2 School Rd", "34 Pine St");
        @SuppressWarnings("unchecked")
        List<String> homeAddressesA =
                JsonPath.read(toJsonA, "$.stops[?(@.kind=='home')].address");
        assertThat(homeAddressesA).containsExactly("12 Oak St");
        assertThat(middleAddressesA).doesNotContain("12 Oak St");

        MvcResult viaB =
                mockMvc.perform(
                                get("/api/family/circle/calendar/FEED/" + practiceB + "/route")
                                        .param("leg", "TO")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value("OK"))
                        .andExpect(jsonPath("$.leg").value("TO"))
                        .andExpect(jsonPath("$.memberItemIds", hasSize(2)))
                        .andReturn();
        String toJsonB = viaB.getResponse().getContentAsString();
        assertThat(JsonPath.<Object>read(toJsonB, "$.stops"))
                .isEqualTo(JsonPath.read(toJsonA, "$.stops"));
        assertThat(JsonPath.<Object>read(toJsonB, "$.legMinutes"))
                .isEqualTo(JsonPath.read(toJsonA, "$.legMinutes"));
        assertThat(JsonPath.<Object>read(toJsonB, "$.memberItemIds"))
                .isEqualTo(JsonPath.read(toJsonA, "$.memberItemIds"));

        MvcResult fromResult =
                mockMvc.perform(
                                get("/api/family/circle/calendar/FEED/" + practiceA + "/route")
                                        .param("leg", "FROM")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value("OK"))
                        .andExpect(jsonPath("$.leg").value("FROM"))
                        .andExpect(jsonPath("$.stops[0].kind").value("destination"))
                        .andExpect(jsonPath("$.stops[-1].kind").value("home"))
                        .andExpect(jsonPath("$.stops[*].kind", hasItem("dropoff")))
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> fromKinds =
                JsonPath.read(fromResult.getResponse().getContentAsString(), "$.stops[*].kind");
        assertThat(fromKinds).contains("dropoff").doesNotContain("pickup");

        @SuppressWarnings("unchecked")
        List<String> pickupAddresses =
                JsonPath.read(toJsonA, "$.stops[?(@.kind=='pickup')].address");
        assertThat(pickupAddresses).hasSize(2);
        String reorderBody =
                "{\"middleStopIds\":[\""
                        + pickupAddresses.get(1)
                        + "\",\""
                        + pickupAddresses.get(0)
                        + "\"]}";
        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + practiceB + "/route")
                                .param("leg", "TO")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(reorderBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.stops[1].address").value(pickupAddresses.get(1)))
                .andExpect(jsonPath("$.stops[2].address").value(pickupAddresses.get(0)));

        // Reorder via the other member item keeps the same persisted order.
        mockMvc.perform(
                        get("/api/family/circle/calendar/FEED/" + practiceA + "/route")
                                .param("leg", "TO")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stops[1].address").value(pickupAddresses.get(1)))
                .andExpect(jsonPath("$.stops[2].address").value(pickupAddresses.get(0)));
    }

    private void acceptRide(String driver, String requester, String spaceId, String eventKey)
            throws Exception {
        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + eventKey + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    private void assignCoverageLeaveFrom(
            String token, String itemId, String adultId, String kidId, String placeId)
            throws Exception {
        MvcResult coverage =
                mockMvc.perform(
                                post("/api/family/circle/calendar/FEED/" + itemId + "/coverages")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"coveringAdultId\":\""
                                                        + adultId
                                                        + "\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String assignmentId =
                JsonPath.read(coverage.getResponse().getContentAsString(), "$.coverages[0].id");
        mockMvc.perform(
                        put("/api/family/circle/calendar/coverages/" + assignmentId + "/leave-from")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"leaveFromPlaceId\":\"" + placeId + "\"}"))
                .andExpect(status().isOk());
    }

    private String organizerAdultId(String token) throws Exception {
        MvcResult circle =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> ids =
                JsonPath.read(
                        circle.getResponse().getContentAsString(),
                        "$.members[?(@.role=='ORGANIZER')].adultId");
        assertThat(ids).isNotEmpty();
        return ids.getFirst();
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
        addPlaceReturningId(token, name, address);
    }

    private String addPlaceReturningId(String token, String name, String address) throws Exception {
        return JsonPath.read(
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
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.latitude").isNumber())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
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
