package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
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

    @Autowired
    private CarpoolApi carpoolApi;

    @Test
    void requestAcceptCancelWithdrawAndAuthz() throws Exception {
        String orgA = signIn("carpool-ride-org-a@example.com");
        String orgB = signIn("carpool-ride-org-b@example.com");
        String outsider = signIn("carpool-ride-out@example.com");

        createCircle(orgA, "Alex", "House A");
        createCircle(orgB, "Sam", "House B");
        createCircle(outsider, "Drew", "House C");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-ride.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-ride.ics", kidB);

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
                        post("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                .andExpect(status().isBadRequest());

        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "Unlocateable Lane");

        MvcResult listed =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$[?(@.eventKey=='" + EVENT_KEY + "')]").isNotEmpty())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> defaultKids =
                JsonPath.read(
                        listed.getResponse().getContentAsString(),
                        "$.[?(@.eventKey=='" + EVENT_KEY + "')].defaultKidIds[0]");
        assertThat(defaultKids).contains(kidA);

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andExpect(jsonPath("$.kidFirstNames[0]").value("Sam"))
                        .andExpect(jsonPath("$.pickupPlaceName").value("Home A"))
                        .andExpect(jsonPath("$.pickupAddress").value("12 Oak St"))
                        .andExpect(jsonPath("$.seats").value(1))
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
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
                                                + "')].otherRequests[0].kidFirstNames[0]")
                                .value("Sam"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].pickupAddress")
                                .value("12 Oak St"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.acceptedByAdultId").isNotEmpty())
                .andExpect(jsonPath("$.acceptingCircleId").isNotEmpty());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/withdraw")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/withdraw")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.acceptedByAdultId").isEmpty());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isForbidden());
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isConflict());
    }

    @Test
    void passIdempotentListPassedByMeAndClearedOnAccept() throws Exception {
        String orgA = signIn("carpool-pass-org-a@example.com");
        String orgB = signIn("carpool-pass-org-b@example.com");
        String outsider = signIn("carpool-pass-out@example.com");

        createCircle(orgA, "Alex", "Pass House A");
        createCircle(orgB, "Sam", "Pass House B");
        createCircle(outsider, "Drew", "Pass House C");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-pass.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-pass.ics", kidB);

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
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.passedByMe").value(false))
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isConflict());
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(outsider)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.passedByMe").value(true))
                .andExpect(jsonPath("$.passedByAdultNames[0]").value("Sam"))
                .andExpect(jsonPath("$.passedByAdultNames.length()").value(1));
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/pass")
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
                                                + "')].otherRequests[0].status")
                                .value("PENDING"))
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
                                                + "')].ownRequest.passedByMe")
                                .value(false))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.passedByAdultNames[0]")
                                .value("Sam"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.passedByMe").value(false))
                .andExpect(jsonPath("$.passedByAdultNames.length()").value(0));
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/withdraw")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
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
    void passNamesClearedOnCancel() throws Exception {
        String orgA = signIn("carpool-pass-cancel-a@example.com");
        String orgB = signIn("carpool-pass-cancel-b@example.com");

        createCircle(orgA, "Alex", "Pass Cancel House A");
        createCircle(orgB, "Sam", "Pass Cancel House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(orgA, "Soccer", "https://example.com/carpool-pass-cancel.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-pass-cancel.ics", kidB);

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

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passedByAdultNames[0]").value("Sam"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.passedByAdultNames.length()").value(0));
    }

    @Test
    void createAllowsNoResponseLeavesRsvpAndAcceptSetsYes() throws Exception {
        String orgA = signIn("carpool-rsvp-org-a@example.com");
        String orgB = signIn("carpool-rsvp-org-b@example.com");

        createCircle(orgA, "Alex", "Rsvp House A");
        createCircle(orgB, "Sam", "Rsvp House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-rsvp.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-rsvp.ics", kidB);

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
        setRsvpYes(orgB, practiceB, kidB);
        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "Unlocateable Lane");

        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + practiceA + "/rsvps/" + kidA)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO\"}"))
                .andExpect(status().isOk());
        MvcResult rejected =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isBadRequest())
                        .andReturn();
        assertThat(JsonPath.<String>read(rejected.getResponse().getContentAsString(), "$.message"))
                .doesNotContain("RSVP Yes first");

        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + practiceA + "/rsvps/" + kidA)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO_RESPONSE\"}"))
                .andExpect(status().isOk());

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
                                                + "')].defaultKidIds[0]")
                                .value(kidA));

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andExpect(jsonPath("$.kidIds[0]").value(kidA))
                        .andReturn();
        String rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.id=='"
                                                + practiceA
                                                + "')].rsvps[?(@.kidId=='"
                                                + kidA
                                                + "')].status")
                                .value("NO_RESPONSE"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$.[?(@.id=='"
                                                + practiceA
                                                + "')].rsvps[?(@.kidId=='"
                                                + kidA
                                                + "')].status")
                                .value("YES"));
    }

    @Test
    void rsvpNoRemovesKidFromPendingAndCancelsAcceptedWhenLastKid() throws Exception {
        String orgA = signIn("carpool-rsvp-no-org-a@example.com");
        String orgB = signIn("carpool-rsvp-no-org-b@example.com");

        createCircle(orgA, "Alex", "RsvpNo House A");
        createCircle(orgB, "Sam", "RsvpNo House B");

        String kidA1 = addKid(orgA, "Sam");
        String kidA2 = addKid(orgA, "Jordan");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(
                        orgA,
                        "Soccer",
                        "https://example.com/carpool-rsvp-no.ics",
                        kidA1,
                        kidA2);
        createFeed(orgB, "Soccer", "https://example.com/carpool-rsvp-no.ics", kidB);

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
        setRsvpYes(orgA, practiceA, kidA1);
        setRsvpYes(orgA, practiceA, kidA2);
        setRsvpYes(orgB, practiceB, kidB);
        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "Unlocateable Lane");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.seats").value(2));

        setRsvpNo(orgA, practiceA, kidA1);

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
                                                + "')].ownRequest.status")
                                .value("PENDING"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.seats")
                                .value(1))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.kidIds[0]")
                                .value(kidA2));

        MvcResult listed =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> rideIds =
                JsonPath.read(
                        listed.getResponse().getContentAsString(),
                        "$.[?(@.eventKey=='" + EVENT_KEY + "')].otherRequests[0].id");
        String rideId = rideIds.getFirst();

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        setRsvpNo(orgA, practiceA, kidA2);

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
                                                + "')].ownRequest")
                                .value((Object) null));
    }

    @Test
    void legMatrixCreateAcceptCancelWithdrawAndOwnLegs() throws Exception {
        String orgA = signIn("carpool-legs-org-a@example.com");
        String orgB = signIn("carpool-legs-org-b@example.com");

        createCircle(orgA, "Alex", "Legs House A");
        createCircle(orgB, "Sam", "Legs House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-legs.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-legs.ics", kidB);

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

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventKey").value(EVENT_KEY))
                .andExpect(jsonPath("$[0].ownRequests").isEmpty())
                .andExpect(jsonPath("$[0].ownLegs").value((Object) null))
                .andExpect(jsonPath("$[0].ownRequest").value((Object) null));

        MvcResult toOnly =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"legs\":[\"TO\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andExpect(jsonPath("$.legs[0].kind").value("TO"))
                        .andExpect(jsonPath("$.legs[0].phase").value("ASKED_TEAM"))
                        .andExpect(jsonPath("$.legs[1].kind").value("FROM"))
                        .andExpect(jsonPath("$.legs[1].phase").value("NEEDS_RIDE"))
                        .andReturn();
        String toOnlyId = JsonPath.read(toOnly.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + toOnlyId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        MvcResult roundTrip =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.legs[0].phase").value("ASKED_TEAM"))
                        .andExpect(jsonPath("$.legs[1].phase").value("ASKED_TEAM"))
                        .andReturn();
        String rideId = JsonPath.read(roundTrip.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"legs\":[\"TO\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.legs[0].phase").value("NEEDS_RIDE"))
                .andExpect(jsonPath("$.legs[1].phase").value("ASKED_TEAM"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/cancel")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_KEY + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        rideId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.legs[0].phase").value("CONFIRMED"))
                .andExpect(jsonPath("$.legs[1].phase").value("CONFIRMED"));

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
                                                + "')].ownLegs[0].phase")
                                .value("CONFIRMED"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownLegs[1].phase")
                                .value("CONFIRMED"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/withdraw")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.legs[0].phase").value("ASKED_TEAM"))
                .andExpect(jsonPath("$.legs[1].phase").value("ASKED_TEAM"));
    }

    @Test
    void saveRidePlanMixedHouseholdAndAskAndListOwnLegs() throws Exception {
        String orgA = signIn("carpool-save-plan-org-a@example.com");
        String careA = signIn("carpool-save-plan-care-a@example.com");
        String orgB = signIn("carpool-save-plan-org-b@example.com");

        createCircle(orgA, "Alex", "Save Plan House A");
        String familyInvite =
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle/invite")
                                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.code");
        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(careA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + familyInvite
                                                + "\",\"adultDisplayName\":\"Blake\"}"))
                .andExpect(status().isOk());
        createCircle(orgB, "Sam", "Save Plan House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(orgA, "Soccer", "https://example.com/carpool-save-plan.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-save-plan.ics", kidB);

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
        setRsvpYes(orgA, practiceA, kidA);
        addPlace(orgA, "Home A", "12 Oak St");

        MvcResult circleA =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                        .andExpect(status().isOk())
                        .andReturn();
        String circleJson = circleA.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> organizerIds =
                JsonPath.read(circleJson, "$.members[?(@.role=='ORGANIZER')].adultId");
        @SuppressWarnings("unchecked")
        List<String> caregiverIds =
                JsonPath.read(circleJson, "$.members[?(@.role=='CAREGIVER')].adultId");
        String alexAdultId = organizerIds.getFirst();
        String blakeAdultId = caregiverIds.getFirst();

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                + alexAdultId
                                                + "\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\"}"
                                                + "]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownRequests.length()").value(1))
                .andExpect(jsonPath("$.ownLegs[0].phase").value("CONFIRMED"))
                .andExpect(jsonPath("$.ownLegs[0].assigneeAdultId").value(alexAdultId))
                .andExpect(jsonPath("$.ownLegs[1].phase").value("ASKED_TEAM"))
                .andExpect(jsonPath("$.ownRequest.status").value("PENDING"))
                .andExpect(jsonPath("$.ownRequest.legs[1].phase").value("ASKED_TEAM"));

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
                                                + "')].ownLegs[0].phase")
                                .value("CONFIRMED"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownLegs[1].phase")
                                .value("ASKED_TEAM"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest.status")
                                .value("PENDING"));

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
                                                + "')].otherRequests[0].legs[0].phase")
                                .value("CONFIRMED"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].legs[1].phase")
                                .value("ASKED_TEAM"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                + blakeAdultId
                                                + "\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"NEEDS_RIDE\"}"
                                                + "]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownRequests.length()").value(1))
                .andExpect(jsonPath("$.ownLegs[0].phase").value("WAITING_HOUSEHOLD"))
                .andExpect(jsonPath("$.ownLegs[1].phase").value("NEEDS_RIDE"))
                .andExpect(jsonPath("$.ownRequest").value((Object) null));

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
                                                + "')].ownLegs[0].phase")
                                .value("WAITING_HOUSEHOLD"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequest")
                                .value((Object) null));

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
                                                + "')].otherRequests[0]")
                                .isEmpty());
    }

    @Test
    void saveRidePlanPersistsDivergingLegPlacesAndBothLegsDefault() throws Exception {
        String orgA = signIn("carpool-leg-places-org-a@example.com");
        String orgB = signIn("carpool-leg-places-org-b@example.com");

        createCircle(orgA, "Alex", "Leg Places House A");
        createCircle(orgB, "Sam", "Leg Places House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(orgA, "Soccer", "https://example.com/carpool-leg-places.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-leg-places.ics", kidB);

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
        setRsvpYes(orgA, practiceA, kidA);
        String grandmaId = addPlace(orgA, "Grandma", "9 Elm St");
        String homeId = addPlace(orgA, "Home A", "12 Oak St");
        mockMvc.perform(
                        patch("/api/family/circle/default-leave-from")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"placeId\":\"" + homeId + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\",\"placeId\":\""
                                                + grandmaId
                                                + "\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\",\"placeAddress\":\"12 Oak St\"}"
                                                + "]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownRequests.length()").value(1))
                .andExpect(jsonPath("$.ownRequest.pickupPlaceName").value("Grandma"))
                .andExpect(jsonPath("$.ownRequest.pickupAddress").value("9 Elm St"))
                .andExpect(jsonPath("$.ownLegs[0].meetSide").value("REQUESTER"))
                .andExpect(jsonPath("$.ownLegs[0].placeId").value(grandmaId))
                .andExpect(jsonPath("$.ownLegs[0].placeName").value("Grandma"))
                .andExpect(jsonPath("$.ownLegs[0].placeAddress").value("9 Elm St"))
                .andExpect(jsonPath("$.ownLegs[1].meetSide").value("REQUESTER"))
                .andExpect(jsonPath("$.ownLegs[1].placeId").value((Object) null))
                .andExpect(jsonPath("$.ownLegs[1].placeAddress").value("12 Oak St"));

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
                                                + "')].ownRequest.pickupPlaceName")
                                .value("Grandma"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownLegs[0].placeId")
                                .value(grandmaId))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownLegs[1].placeAddress")
                                .value("12 Oak St"));

        // Simple both-legs Default: omit place fields → same resolved Home A on TO/FROM.
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\"}"
                                                + "]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownRequest.pickupPlaceName").value("Home A"))
                .andExpect(jsonPath("$.ownRequest.pickupAddress").value("12 Oak St"))
                .andExpect(jsonPath("$.ownLegs[0].meetSide").value("REQUESTER"))
                .andExpect(jsonPath("$.ownLegs[0].placeId").value((Object) null))
                .andExpect(jsonPath("$.ownLegs[0].placeName").value("Home A"))
                .andExpect(jsonPath("$.ownLegs[0].placeAddress").value("12 Oak St"))
                .andExpect(jsonPath("$.ownLegs[1].meetSide").value("REQUESTER"))
                .andExpect(jsonPath("$.ownLegs[1].placeId").value((Object) null))
                .andExpect(jsonPath("$.ownLegs[1].placeName").value("Home A"))
                .andExpect(jsonPath("$.ownLegs[1].placeAddress").value("12 Oak St"));
    }

    @Test
    void saveAskMeetSideAcceptorPersistsAcceptBindsAndOmitsRequesterPickup() throws Exception {
        String orgA = signIn("carpool-meet-at-org-a@example.com");
        String orgB = signIn("carpool-meet-at-org-b@example.com");

        createCircle(orgA, "Alex", "Meet At House A");
        createCircle(orgB, "Sam", "Meet At House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(orgA, "Soccer", "https://example.com/carpool-meet-at.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-meet-at.ics", kidB);

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
        addPlace(orgA, "Home A", "12 Oak St, Cambridge, MA 02139");
        addPlace(orgB, "Home B", "100 Main St, Somerville, MA");

        MvcResult saved =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"plans\":[{\"kidIds\":[\""
                                                        + kidA
                                                        + "\"],\"legs\":["
                                                        + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\",\"meetSide\":\"ACCEPTOR\"},"
                                                        + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\",\"meetSide\":\"REQUESTER\"}"
                                                        + "]}]}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.ownRequest.status").value("PENDING"))
                        .andExpect(jsonPath("$.ownRequest.pickupPlaceName").value("Driver's place"))
                        .andExpect(jsonPath("$.ownRequest.pickupAddress").value(""))
                        .andExpect(jsonPath("$.ownLegs[0].meetSide").value("ACCEPTOR"))
                        .andExpect(jsonPath("$.ownLegs[0].placeAddress").value((Object) null))
                        .andExpect(jsonPath("$.ownLegs[1].meetSide").value("REQUESTER"))
                        .andExpect(jsonPath("$.ownLegs[1].placeName").value("Home A"))
                        .andExpect(
                                jsonPath("$.ownLegs[1].placeAddress")
                                        .value("12 Oak St, Cambridge, MA 02139"))
                        .andReturn();
        String rideId = JsonPath.read(saved.getResponse().getContentAsString(), "$.ownRequest.id");

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
                                                + "')].otherRequests[0].legs[0].meetSide")
                                .value("ACCEPTOR"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].otherRequests[0].detourMinutes")
                                .value((Object) null));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.pickupPlaceName").value("Home B"))
                .andExpect(jsonPath("$.pickupAddress").value("100 Main St, Somerville, MA"))
                .andExpect(jsonPath("$.legs[0].meetSide").value("ACCEPTOR"))
                .andExpect(jsonPath("$.legs[0].placeName").value("Home B"))
                .andExpect(jsonPath("$.legs[0].placeAddress").value("100 Main St, Somerville, MA"))
                .andExpect(jsonPath("$.legs[1].meetSide").value("REQUESTER"))
                .andExpect(jsonPath("$.legs[1].placeName").value("Home A"))
                .andExpect(
                        jsonPath("$.legs[1].placeAddress").value("12 Oak St, Cambridge, MA 02139"));

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
                                                + "')].ownRequest.pickupPlaceName")
                                .value("Home B"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownLegs[0].placeAddress")
                                .value("100 Main St, Somerville, MA"));

        // Pickup list that feeds accepter Route building: TO ACCEPTOR → no
        // requester-house stop (null name/address), even though FROM stays
        // requester place for drop-off.
        String circleBId =
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle")
                                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.id");
        List<CarpoolAcceptedPickupDto> accepterPickups =
                carpoolApi.listAcceptedPickupsForFeedEvent(
                        UUID.fromString(circleBId), UUID.fromString(practiceB));
        assertThat(accepterPickups).hasSize(1);
        assertThat(accepterPickups.getFirst().pickupPlaceName()).isNull();
        assertThat(accepterPickups.getFirst().pickupAddress()).isNull();
        assertThat(accepterPickups.getFirst().kidIds()).containsExactly(UUID.fromString(kidA));
    }

    @Test
    void acceptAcceptorMeet400WhenAccepterHasNoPlace() throws Exception {
        String orgA = signIn("carpool-meet-at-400-org-a@example.com");
        String orgB = signIn("carpool-meet-at-400-org-b@example.com");

        createCircle(orgA, "Alex", "Meet At 400 House A");
        createCircle(orgB, "Sam", "Meet At 400 House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(
                        orgA, "Soccer", "https://example.com/carpool-meet-at-400.ics", kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-meet-at-400.ics", kidB);

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

        MvcResult saved =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"plans\":[{\"kidIds\":[\""
                                                        + kidA
                                                        + "\"],\"legs\":["
                                                        + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\",\"meetSide\":\"ACCEPTOR\"},"
                                                        + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\",\"meetSide\":\"ACCEPTOR\"}"
                                                        + "]}]}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.ownRequest.status").value("PENDING"))
                        .andReturn();
        String rideId = JsonPath.read(saved.getResponse().getContentAsString(), "$.ownRequest.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void saveRidePlanAsk400WhenNoResolvableToPickup() throws Exception {
        String orgA = signIn("carpool-leg-places-no-pickup@example.com");
        createCircle(orgA, "Alex", "No Pickup House");
        String kidA = addKid(orgA, "Sam");
        String feedA =
                createFeed(
                        orgA, "Soccer", "https://example.com/carpool-leg-places-no-pickup.ics", kidA);

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedA + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String practiceA = feedEventId(orgA, "Practice");
        setRsvpYes(orgA, practiceA, kidA);

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + EVENT_KEY
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\"}"
                                                + "]}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void circleLocalRidePlansSaveAndList() throws Exception {
        String orgA = signIn("carpool-circle-plan-org@example.com");
        createCircle(orgA, "Alex", "House A");
        String kidA = addKid(orgA, "Sam");
        addPlace(orgA, "Home A", "12 Oak St");

        MvcResult circleA =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> organizerIds =
                JsonPath.read(
                        circleA.getResponse().getContentAsString(),
                        "$.members[?(@.role=='ORGANIZER')].adultId");
        String alexAdultId = organizerIds.getFirst();
        String eventKey = "CAL:MANUAL:circle-plan-1";

        mockMvc.perform(
                        post("/api/carpool/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + eventKey
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                + alexAdultId
                                                + "\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                + alexAdultId
                                                + "\"}"
                                                + "]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownRequests.length()").value(1))
                .andExpect(jsonPath("$.ownLegs[0].phase").value("CONFIRMED"))
                .andExpect(jsonPath("$.ownLegs[1].phase").value("CONFIRMED"))
                .andExpect(jsonPath("$.ownRequest").value((Object) null));

        mockMvc.perform(
                        get("/api/carpool/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventKey").value(eventKey))
                .andExpect(jsonPath("$[0].ownRequests.length()").value(1))
                .andExpect(jsonPath("$[0].ownLegs[0].phase").value("CONFIRMED"))
                .andExpect(jsonPath("$[0].ownRequest").value((Object) null));

        mockMvc.perform(
                        post("/api/carpool/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + eventKey
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"NEEDS_RIDE\"}"
                                                + "]}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void saveRidePlanSplitsKidsAndAcceptConfirmsAskOnly() throws Exception {
        String orgA = signIn("carpool-split-plan-org-a@example.com");
        String orgB = signIn("carpool-split-plan-org-b@example.com");

        createCircle(orgA, "Alex", "Split Plan House A");
        createCircle(orgB, "Sam", "Split Plan House B");

        String kidA = addKid(orgA, "Maya");
        String kidB = addKid(orgA, "Noah");
        String kidOther = addKid(orgB, "Riley");
        String feedA =
                createFeed(
                        orgA,
                        "Soccer",
                        "https://example.com/carpool-split-plan.ics",
                        kidA,
                        kidB);
        createFeed(orgB, "Soccer", "https://example.com/carpool-split-plan.ics", kidOther);

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
        setRsvpYes(orgA, practiceA, kidA);
        setRsvpYes(orgA, practiceA, kidB);
        addPlace(orgA, "Home A", "12 Oak St");

        String alexAdultId =
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle")
                                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.members[0].adultId");

        MvcResult saved =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/ride-plans")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"eventKey\":\""
                                                        + EVENT_KEY
                                                        + "\",\"plans\":["
                                                        + "{\"kidIds\":[\""
                                                        + kidA
                                                        + "\"],\"legs\":["
                                                        + "{\"kind\":\"TO\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                        + alexAdultId
                                                        + "\"},"
                                                        + "{\"kind\":\"FROM\",\"action\":\"NEEDS_RIDE\"}"
                                                        + "]},"
                                                        + "{\"kidIds\":[\""
                                                        + kidB
                                                        + "\"],\"legs\":["
                                                        + "{\"kind\":\"TO\",\"action\":\"ASK_TEAM\"},"
                                                        + "{\"kind\":\"FROM\",\"action\":\"ASK_TEAM\"}"
                                                        + "]}"
                                                        + "]}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.ownRequests.length()").value(2))
                        .andExpect(jsonPath("$.ownRequest").value((Object) null))
                        .andExpect(jsonPath("$.ownLegs").value((Object) null))
                        .andReturn();

        String savedJson = saved.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<String> statuses = JsonPath.read(savedJson, "$.ownRequests[*].status");
        assertThat(statuses).containsExactlyInAnyOrder("PLAN", "PENDING");
        @SuppressWarnings("unchecked")
        List<String> askIds =
                JsonPath.read(savedJson, "$.ownRequests[?(@.status=='PENDING')].id");
        assertThat(askIds).hasSize(1);
        String askRideId = askIds.getFirst();
        @SuppressWarnings("unchecked")
        List<List<String>> askKidIds =
                JsonPath.read(savedJson, "$.ownRequests[?(@.status=='PENDING')].kidIds");
        assertThat(askKidIds.getFirst()).containsExactly(kidB);

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + askRideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.kidIds.length()").value(1))
                .andExpect(jsonPath("$.kidIds[0]").value(kidB));

        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + practiceA + "/rsvps/" + kidA)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO\"}"))
                .andExpect(status().isOk());

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
                                                + "')].ownRequests.length()")
                                .value(1))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].status")
                                .value("ACCEPTED"))
                .andExpect(
                        jsonPath(
                                        "$.[?(@.eventKey=='"
                                                + EVENT_KEY
                                                + "')].ownRequests[0].kidIds[0]")
                                .value(kidB));
    }

    @Test
    void linkedManualListRidesDefaultGoingEnableAttachAndRelink409() throws Exception {
        String orgA = signIn("carpool-manual-link-org-a@example.com");
        String orgB = signIn("carpool-manual-link-org-b@example.com");

        createCircle(orgA, "Alex", "Manual Link House A");
        createCircle(orgB, "Sam", "Manual Link House B");

        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA =
                createFeed(
                        orgA,
                        "Soccer",
                        "https://example.com/carpool-manual-link.ics",
                        kidA);
        createFeed(orgB, "Soccer", "https://example.com/carpool-manual-link.ics", kidB);

        String eventId =
                JsonPath.read(
                        mockMvc.perform(
                                        post("/api/family/circle/events")
                                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(
                                                        "{\"title\":\"Banquet\",\"startsAt\":\"2026-08-20T18:00:00Z\",\"kidIds\":[\""
                                                                + kidA
                                                                + "\"],\"feedId\":\""
                                                                + feedA
                                                                + "\"}"))
                                .andExpect(status().isCreated())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.id");
        String eventKey = "CAL:MANUAL:" + eventId;

        MvcResult circleA =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> organizerIds =
                JsonPath.read(
                        circleA.getResponse().getContentAsString(),
                        "$.members[?(@.role=='ORGANIZER')].adultId");
        String alexAdultId = organizerIds.getFirst();
        addPlace(orgA, "Home A", "12 Oak St");

        mockMvc.perform(
                        post("/api/carpool/ride-plans")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventKey\":\""
                                                + eventKey
                                                + "\",\"plans\":[{\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"legs\":["
                                                + "{\"kind\":\"TO\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                + alexAdultId
                                                + "\"},"
                                                + "{\"kind\":\"FROM\",\"action\":\"HOUSEHOLD\",\"assigneeAdultId\":\""
                                                + alexAdultId
                                                + "\"}"
                                                + "]}]}"))
                .andExpect(status().isOk());

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

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.eventKey=='" + eventKey + "')].title").value("Banquet"))
                .andExpect(
                        jsonPath("$[?(@.eventKey=='" + eventKey + "')].ownRequests[0].status")
                                .value("PLAN"))
                .andExpect(
                        jsonPath("$[?(@.eventKey=='" + eventKey + "')].defaultKidIds[0]")
                                .value(kidA));

        mockMvc.perform(
                        put("/api/family/circle/events/" + eventId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Banquet\",\"startsAt\":\"2026-08-20T18:00:00Z\",\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"feedId\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedId").value((Object) null));

        mockMvc.perform(
                        put("/api/family/circle/events/" + eventId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Banquet\",\"startsAt\":\"2026-08-20T18:00:00Z\",\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"feedId\":\""
                                                + feedA
                                                + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedId").value(feedA));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"eventKey\":\"" + eventKey + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.kidIds[0]").value(kidA));

        mockMvc.perform(
                        put("/api/family/circle/events/" + eventId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Banquet\",\"startsAt\":\"2026-08-20T18:00:00Z\",\"kidIds\":[\""
                                                + kidA
                                                + "\"],\"feedId\":null}"))
                .andExpect(status().isConflict());

        addPlace(orgB, "Home B", "Unlocateable Lane");
        MvcResult ridesForB =
                mockMvc.perform(
                                get("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> rideIds =
                JsonPath.read(
                        ridesForB.getResponse().getContentAsString(),
                        "$.[?(@.eventKey=='" + eventKey + "')].otherRequests[0].id");
        String rideId = rideIds.getFirst();

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        setManualRsvpNo(orgA, eventId, kidA);

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .param("from", FROM)
                                .param("to", TO))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$[?(@.eventKey=='" + eventKey + "')].ownRequest")
                                .value((Object) null));

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", FROM)
                                .param("to", TO)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + eventId + "')]").isEmpty());
    }

    private void setManualRsvpYes(String token, String itemId, String kidId) throws Exception {
        mockMvc.perform(
                        put("/api/family/circle/calendar/MANUAL/" + itemId + "/rsvps/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"YES\"}"))
                .andExpect(status().isOk());
    }

    private void setManualRsvpNo(String token, String itemId, String kidId) throws Exception {
        mockMvc.perform(
                        put("/api/family/circle/calendar/MANUAL/" + itemId + "/rsvps/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO\"}"))
                .andExpect(status().isOk());
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

    private String createFeed(String token, String name, String url, String... kidIds)
            throws Exception {
        String kidsJson =
                java.util.Arrays.stream(kidIds)
                        .map(id -> "\"" + id + "\"")
                        .collect(java.util.stream.Collectors.joining(","));
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
                                                        + "\",\"kidIds\":["
                                                        + kidsJson
                                                        + "]}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }

    private void setRsvpNo(String token, String itemId, String kidId) throws Exception {
        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + itemId + "/rsvps/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO\"}"))
                .andExpect(status().isOk());
    }

    private String addPlace(String token, String name, String address) throws Exception {
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
