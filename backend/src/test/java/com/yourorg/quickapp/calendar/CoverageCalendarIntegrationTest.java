package com.yourorg.quickapp.calendar;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class CoverageCalendarIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void assignConfirmAndNeedsCoverage() throws Exception {
        String organizerToken = signIn("coverage-org@example.com");
        String caregiverToken = signIn("coverage-care@example.com");

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

        MvcResult kidAResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidA = JsonPath.read(kidAResult.getResponse().getContentAsString(), "$.id");

        MvcResult kidBResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Riley\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidB = JsonPath.read(kidBResult.getResponse().getContentAsString(), "$.id");

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Game\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"kidIds\":[\""
                                                        + kidA
                                                        + "\",\""
                                                        + kidB
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].uncoveredKidIds.length()").value(2))
                .andExpect(jsonPath("$[0].coverages").isEmpty());

        MvcResult assigned =
                mockMvc.perform(
                                post("/api/family/circle/calendar/MANUAL/" + eventId + "/coverages")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"coveringAdultId\":\""
                                                        + caregiverAdultId
                                                        + "\",\"kidIds\":[\""
                                                        + kidA
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.coverages[0].status").value("PENDING"))
                        .andExpect(jsonPath("$.uncoveredKidIds.length()").value(1))
                        .andReturn();
        String assignmentId =
                JsonPath.read(assigned.getResponse().getContentAsString(), "$.coverages[0].id");

        mockMvc.perform(
                        post("/api/family/circle/calendar/coverages/" + assignmentId + "/confirm")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverages[0].status").value("CONFIRMED"));

        mockMvc.perform(
                        post("/api/family/circle/calendar/coverages/" + assignmentId + "/confirm")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        delete("/api/family/circle/calendar/coverages/" + assignmentId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverages").isEmpty())
                .andExpect(jsonPath("$.uncoveredKidIds.length()").value(2));
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
