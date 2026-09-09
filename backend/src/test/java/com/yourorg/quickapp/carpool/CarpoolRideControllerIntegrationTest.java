package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class CarpoolRideControllerIntegrationTest {

    private static final String FROM = "2026-08-01T00:00:00Z";
    private static final String TO = "2026-09-01T00:00:00Z";
    private static final String EVENT_KEY = "UID:stub-game-1@example.com";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void requestAcceptPartialCancelWithdrawAndAuthz() throws Exception {
        String orgA = signIn("carpool-ride-v2-org-a@example.com");
        String orgB = signIn("carpool-ride-v2-org-b@example.com");
        String outsider = signIn("carpool-ride-v2-out@example.com");

        createCircle(orgA, "Alex", "House A");
        createCircle(orgB, "Sam", "House B");
        createCircle(outsider, "Drew", "House C");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-ride-v2.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-ride-v2.ics", kidB);

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

        String practiceA = feedEventId(orgA, "Practice");
        String practiceB = feedEventId(orgB, "Practice");
        setRsvpYes(orgA, practiceA, kidA);
        setRsvpYes(orgB, practiceB, kidB);

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(outsider))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isNotFound());
        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", "2026-09-02T00:00:00Z"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", TO)
                                .param("to", FROM))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-requests")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"kidId\":\""
                                                + kidA
                                                + "\"}"))
                .andExpect(status().isBadRequest());

        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "Unlocateable Lane");

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/ride-requests")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"kidId\":\""
                                                        + kidA
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("UNCOVERED"))
                        .andExpect(jsonPath("$.legsNeeded", containsInAnyOrder("TO", "FROM")))
                        .andExpect(jsonPath("$.kidId").value(kidA))
                        .andExpect(jsonPath("$.kidFirstName").value("Sam"))
                        .andExpect(jsonPath("$.pickupPlaceName").value("Home A"))
                        .andExpect(jsonPath("$.pickupAddress").value("12 Oak St"))
                        .andReturn();
        String requestId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-requests")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"kidId\":\""
                                                + kidA
                                                + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].kidFirstName")
                                .value("Sam"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].pickupAddress")
                                .value("12 Oak St"));

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].id")
                                .value(requestId))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].status")
                                .value("UNCOVERED"));

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"vehicleId\":\"01900000-0000-7000-8000-000000000071\"}"))
                .andExpect(status().isConflict());

        String vehicleId = addVehicle(orgB, "Van", 7);
        mockMvc.perform(
                        patch("/api/family/circle/garage/me")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"drives\":false}"))
                .andExpect(status().isOk());
        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"vehicleId\":\"" + vehicleId + "\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(
                        patch("/api/family/circle/garage/me")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"drives\":true}"))
                .andExpect(status().isOk());

        MvcResult accepted =
                mockMvc.perform(
                                post("/api/carpool/spaces/"
                                                + spaceId
                                                + "/ride-requests/"
                                                + requestId
                                                + "/accept")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"vehicleId\":\"" + vehicleId + "\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$", hasSize(2)))
                        .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                        .andExpect(jsonPath("$[1].status").value("ACTIVE"))
                        .andExpect(jsonPath("$[*].leg", containsInAnyOrder("TO", "FROM")))
                        .andReturn();
        String acceptBody = accepted.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> fromRideIds = JsonPath.read(acceptBody, "$[?(@.leg=='FROM')].id");
        @SuppressWarnings("unchecked")
        List<String> toRideIds = JsonPath.read(acceptBody, "$[?(@.leg=='TO')].id");
        assertThat(fromRideIds).hasSize(1);
        assertThat(toRideIds).hasSize(1);
        String fromRideId = fromRideIds.getFirst();
        String toRideId = toRideIds.getFirst();

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].status")
                                .value("FULLY_COVERED"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].rides[0].status")
                                .value("ACTIVE"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].rides[1].status")
                                .value("ACTIVE"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + fromRideId + "/withdraw")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isForbidden());
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + fromRideId + "/withdraw")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.leg").value("FROM"));

        MvcResult afterWithdraw =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andExpect(
                                jsonPath(
                                                "$.[?(@.eventKey=='"
                                                        + EVENT_KEY
                                                        + "')].ownRequests[0].status")
                                        .value("PARTIAL"))
                        .andReturn();
        String afterWithdrawJson = afterWithdraw.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> remainingLegs =
                JsonPath.read(
                        afterWithdrawJson,
                        "$.[?(@.eventKey=='" + EVENT_KEY + "')].rides[*].leg");
        assertThat(remainingLegs).containsExactly("TO");
        @SuppressWarnings("unchecked")
        List<String> toStatuses =
                JsonPath.read(
                        afterWithdrawJson,
                        "$.[?(@.eventKey=='"
                                + EVENT_KEY
                                + "')].ownRequests[0].legStatuses[?(@.leg=='TO')].status");
        @SuppressWarnings("unchecked")
        List<String> fromStatuses =
                JsonPath.read(
                        afterWithdrawJson,
                        "$.[?(@.eventKey=='"
                                + EVENT_KEY
                                + "')].ownRequests[0].legStatuses[?(@.leg=='FROM')].status");
        assertThat(toStatuses).containsExactly("CONFIRMED");
        assertThat(fromStatuses).containsExactly("OPEN");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + toRideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isForbidden());
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + toRideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.leg").value("TO"));
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + toRideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isConflict());
    }

    @Test
    void passIdempotentAndClearedOnAccept() throws Exception {
        String orgA = signIn("carpool-pass-v2-org-a@example.com");
        String orgB = signIn("carpool-pass-v2-org-b@example.com");
        String outsider = signIn("carpool-pass-v2-out@example.com");

        createCircle(orgA, "Alex", "Pass House A");
        createCircle(orgB, "Sam", "Pass House B");
        createCircle(outsider, "Drew", "Pass House C");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-pass-v2.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-pass-v2.ics", kidB);

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

        String practiceA = feedEventId(orgA, "Practice");
        String practiceB = feedEventId(orgB, "Practice");
        setRsvpYes(orgA, practiceA, kidA);
        setRsvpYes(orgB, practiceB, kidB);
        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "Unlocateable Lane");

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/ride-requests")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"kidId\":\""
                                                        + kidA
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.passedByMe").value(false))
                        .andExpect(jsonPath("$.status").value("UNCOVERED"))
                        .andReturn();
        String requestId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isConflict());
        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(outsider)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNCOVERED"))
                .andExpect(jsonPath("$.passedByMe").value(true))
                .andExpect(jsonPath("$.passedByAdultNames[0]").value("Sam"))
                .andExpect(jsonPath("$.passedByAdultNames.length()").value(1));
        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passedByMe").value(true))
                .andExpect(jsonPath("$.passedByAdultNames[0]").value("Sam"));

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].passedByMe")
                                .value(true))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].passedByAdultNames[0]")
                                .value("Sam"));
        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].passedByMe")
                                .value(false))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].passedByAdultNames[0]")
                                .value("Sam"));

        String vehicleId = addVehicle(orgB, "Van", 7);
        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"vehicleId\":\"" + vehicleId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].passedByMe")
                                .value(false))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].passedByAdultNames.length()")
                                .value(0));
    }

    @Test
    void patchLegsAndAcceptOnlyOpenLeg() throws Exception {
        String orgA = signIn("carpool-patch-v2-org-a@example.com");
        String orgB = signIn("carpool-patch-v2-org-b@example.com");

        createCircle(orgA, "Alex", "Patch House A");
        createCircle(orgB, "Sam", "Patch House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(orgA, "Soccer", "https://example.com/carpool-patch-v2.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-patch-v2.ics", kidB);

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
        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "Unlocateable Lane");

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/ride-requests")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"kidId\":\""
                                                        + kidA
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.legsNeeded", containsInAnyOrder("TO", "FROM")))
                        .andReturn();
        String requestId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        patch("/api/carpool/spaces/" + spaceId + "/ride-requests/" + requestId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"legsNeeded\":[\"FROM\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.legsNeeded", containsInAnyOrder("FROM")))
                .andExpect(jsonPath("$.status").value("UNCOVERED"));

        String vehicleId = addVehicle(orgB, "Van", 7);
        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/ride-requests/"
                                        + requestId
                                        + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"vehicleId\":\"" + vehicleId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].leg").value("FROM"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
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
