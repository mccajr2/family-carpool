package com.yourorg.quickapp.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

@SpringBootTest
@AutoConfigureMockMvc
class RemoveCoverageWithdrawsInboundIntegrationTest {

    private static final String FROM = "2026-08-01T00:00:00Z";
    private static final String TO = "2026-09-01T00:00:00Z";
    private static final String EVENT_KEY = "UID:stub-game-1@example.com";
    private static final String FEED_URL = "https://example.com/carpool-remove-coverage.ics";
    private static final String RSVP_WITHDRAW_FEED_URL =
            "https://example.com/carpool-rsvp-withdraw.ics";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void removingConfirmedCoverageWithdrawsAcceptedInboundRideToPending() throws Exception {
        String driver = signIn("remove-coverage-driver@example.com");
        String requester = signIn("remove-coverage-requester@example.com");

        createCircle(driver, "Alex", "House Driver");
        createCircle(requester, "Sam", "House Requester");

        String driverKid = addKid(driver, "Riley");
        String requesterKid = addKid(requester, "Sam");
        String feedDriver = createFeed(driver, "Soccer", FEED_URL, driverKid);
        createFeed(requester, "Soccer", FEED_URL, requesterKid);

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

        String practiceDriver = feedEventId(driver, "Practice");
        String practiceRequester = feedEventId(requester, "Practice");
        setRsvpYes(driver, practiceDriver, driverKid);
        setRsvpYes(requester, practiceRequester, requesterKid);
        addPlace(driver, "Home A", "12 Oak St");
        addPlace(requester, "Home B", "34 Pine St");
        String vehicleId = addVehicle(driver, "Van", 7);

        String driverAdultId = organizerAdultId(driver);
        MvcResult assigned =
                mockMvc.perform(
                                post("/api/family/circle/calendar/FEED/"
                                                + practiceDriver
                                                + "/coverages")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"coveringAdultId\":\""
                                                        + driverAdultId
                                                        + "\",\"kidIds\":[\""
                                                        + driverKid
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.coverages[0].status").value("CONFIRMED"))
                        .andReturn();
        String assignmentId =
                JsonPath.read(assigned.getResponse().getContentAsString(), "$.coverages[0].id");

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"vehicleId\":\"" + vehicleId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        mockMvc.perform(
                        delete("/api/family/circle/calendar/coverages/" + assignmentId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverages").isEmpty());

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.status")
                                .value("PENDING"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.id")
                                .value(rideId));
    }

    @Test
    void markingNotGoingWithdrawsAcceptedInboundRideToPending() throws Exception {
        String driver = signIn("rsvp-withdraw-driver@example.com");
        String requester = signIn("rsvp-withdraw-requester@example.com");

        createCircle(driver, "Alex", "House Driver");
        createCircle(requester, "Sam", "House Requester");

        String driverKid = addKid(driver, "Apollo");
        String requesterKid = addKid(requester, "Declan");
        String feedDriver = createFeed(driver, "Soccer", RSVP_WITHDRAW_FEED_URL, driverKid);
        createFeed(requester, "Soccer", RSVP_WITHDRAW_FEED_URL, requesterKid);

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

        String practiceDriver = feedEventId(driver, "Practice");
        String practiceRequester = feedEventId(requester, "Practice");
        setRsvpYes(driver, practiceDriver, driverKid);
        setRsvpYes(requester, practiceRequester, requesterKid);
        addPlace(driver, "Home A", "12 Oak St");
        addPlace(requester, "Home B", "34 Pine St");
        String vehicleId = addVehicle(driver, "Van", 7);

        String driverAdultId = organizerAdultId(driver);
        mockMvc.perform(
                        post("/api/family/circle/calendar/FEED/"
                                        + practiceDriver
                                        + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + driverAdultId
                                                + "\",\"kidIds\":[\""
                                                + driverKid
                                                + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverages[0].status").value("CONFIRMED"));

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"vehicleId\":\"" + vehicleId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/"
                                        + practiceDriver
                                        + "/rsvps/"
                                        + driverKid)
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverages").isEmpty())
                .andExpect(jsonPath("$.rsvps[?(@.kidId=='" + driverKid + "')].status").value("NO"));

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.status")
                                .value("PENDING"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.id")
                                .value(rideId));
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

    private String addVehicle(String token, String label, int seats) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                post("/api/family/circle/garage/vehicles")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"label\":\""
                                                        + label
                                                        + "\",\"year\":2020,\"make\":\"HONDA\",\"model\":\"Odyssey\",\"seats\":"
                                                        + seats
                                                        + "}"))
                        .andExpect(status().isCreated())
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
