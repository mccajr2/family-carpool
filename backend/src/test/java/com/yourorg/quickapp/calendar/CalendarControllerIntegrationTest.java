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
class CalendarControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void caregiverSeesMergedFeedAndManualInRange() throws Exception {
        String organizerToken = signIn("cal-org@example.com");
        String caregiverToken = signIn("cal-care@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        String code =
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle/invite")
                                                .header(
                                                        HttpHeaders.AUTHORIZATION,
                                                        bearer(organizerToken)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.code");

        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Jordan\"}"))
                .andExpect(status().isOk());

        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidId = JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Dentist\",\"startsAt\":\"2026-08-15T16:00:00Z\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"U12\",\"sourceUrl\":\"https://example.com/team.ics\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].title").value("Dentist"))
                .andExpect(jsonPath("$[0].source").value("MANUAL"))
                .andExpect(jsonPath("$[1].title").value("Practice"))
                .andExpect(jsonPath("$[1].source").value("FEED"))
                .andExpect(jsonPath("$[1].feedName").value("U12"))
                .andExpect(jsonPath("$[1].kidIds[0]").value(kidId))
                .andExpect(jsonPath("$[2].title").value("Scrimmage"));

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-20T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-15T00:00:00Z")
                                .param("to", "2026-08-15T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before to"));

        mockMvc.perform(
                        get("/api/family/circle/calendar/leave-by")
                                .param("from", "2026-08-15T00:00:00Z")
                                .param("to", "2026-08-15T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before to"));
    }

    @Test
    void unauthenticatedAndNoMembershipReturn401And404() throws Exception {
        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(
                        get("/api/family/circle/calendar/leave-by")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());

        String token = signIn("cal-lonely@example.com");
        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        get("/api/family/circle/calendar/leave-by")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());
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
