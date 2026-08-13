package com.yourorg.quickapp.calendar;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
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
class ConflictCalendarIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void kidOverlapAndAdultAmberAndConfirmedDoubleBook409() throws Exception {
        String organizerToken = signIn("conflict-org@example.com");
        String caregiverToken = signIn("conflict-care@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult invite =
                mockMvc.perform(
                                get("/api/family/circle/invite")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                        .andExpect(status().isOk())
                        .andReturn();
        String code = JsonPath.read(invite.getResponse().getContentAsString(), "$.code");

        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Jordan\"}"))
                .andExpect(status().isOk());

        MvcResult circleAsCare =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        java.util.List<String> caregiverIds =
                JsonPath.read(
                        circleAsCare.getResponse().getContentAsString(),
                        "$.members[?(@.role=='CAREGIVER')].adultId");
        String caregiverAdultId = caregiverIds.getFirst();

        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidId = JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");

        MvcResult eventA =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Practice\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"endsAt\":\"2026-08-15T18:00:00Z\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventAId = JsonPath.read(eventA.getResponse().getContentAsString(), "$.id");

        MvcResult eventB =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Game\",\"startsAt\":\"2026-08-15T17:30:00Z\",\"endsAt\":\"2026-08-15T18:30:00Z\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventBId = JsonPath.read(eventB.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].conflicts[0].type").value("KID_TIME_OVERLAP"))
                .andExpect(jsonPath("$[1].conflicts[0].type").value("KID_TIME_OVERLAP"));

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventAId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + caregiverAdultId
                                                + "\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverages[0].status").value("PENDING"));

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventBId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + caregiverAdultId
                                                + "\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverages[0].status").value("PENDING"))
                .andExpect(
                        jsonPath("$.conflicts[?(@.type=='ADULT_COVERAGE_OVERLAP')]").isNotEmpty());

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$[?(@.id=='"
                                                + eventAId
                                                + "')].conflicts[?(@.type=='ADULT_COVERAGE_OVERLAP')]")
                                .isNotEmpty())
                .andExpect(
                        jsonPath(
                                        "$[?(@.id=='"
                                                + eventBId
                                                + "')].conflicts[?(@.type=='ADULT_COVERAGE_OVERLAP')]")
                                .isNotEmpty());

        MvcResult calendar =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                        .param("from", "2026-08-01T00:00:00Z")
                                        .param("to", "2026-09-01T00:00:00Z"))
                        .andExpect(status().isOk())
                        .andReturn();
        String body = calendar.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        java.util.List<String> aAssignmentIds =
                JsonPath.read(
                        body,
                        "$[?(@.id=='" + eventAId + "')].coverages[0].id");
        @SuppressWarnings("unchecked")
        java.util.List<String> bAssignmentIds =
                JsonPath.read(
                        body,
                        "$[?(@.id=='" + eventBId + "')].coverages[0].id");
        String assignmentA = aAssignmentIds.getFirst();
        String assignmentB = bAssignmentIds.getFirst();

        mockMvc.perform(
                        post("/api/family/circle/calendar/coverages/" + assignmentA + "/confirm")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverages[0].status").value("CONFIRMED"));

        mockMvc.perform(
                        post("/api/family/circle/calendar/coverages/" + assignmentB + "/confirm")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventBId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + caregiverAdultId
                                                + "\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isConflict());
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
