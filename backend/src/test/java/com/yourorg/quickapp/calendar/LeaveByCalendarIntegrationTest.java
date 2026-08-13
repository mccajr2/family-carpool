package com.yourorg.quickapp.calendar;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class LeaveByCalendarIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void calendarEnrichmentAndSetLeaveFrom() throws Exception {
        String token = signIn("leaveby-org@example.com");

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

        MvcResult placeResult =
                mockMvc.perform(
                                post("/api/family/circle/places")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Mom's house\",\"address\":\"1 Main Street\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.latitude").isNumber())
                        .andReturn();
        String placeId = JsonPath.read(placeResult.getResponse().getContentAsString(), "$.id");

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Practice\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"location\":\"Rink Field\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        // Default leave-from = first located place; stub OSRM → OK estimate
        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Practice"))
                .andExpect(jsonPath("$[0].leaveByStatus").value("PENDING"))
                .andExpect(jsonPath("$[0].leaveFromPlaceId").value(placeId))
                .andExpect(jsonPath("$[0].leaveFromPlaceName").value("Mom's house"))
                .andExpect(jsonPath("$[0].leaveByAt").value(nullValue()));

        mockMvc.perform(
                        get("/api/family/circle/calendar/leave-by")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(eventId))
                .andExpect(jsonPath("$[0].source").value("MANUAL"))
                .andExpect(jsonPath("$[0].leaveByStatus").value("OK"))
                .andExpect(jsonPath("$[0].leaveFromPlaceId").value(placeId))
                .andExpect(jsonPath("$[0].leaveByAt").isNotEmpty());

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-09-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].leaveByStatus").value("OK"))
                .andExpect(jsonPath("$[0].leaveByAt").isNotEmpty());

        // Soft-fail: blank location → UNAVAILABLE
        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"No loc\",\"startsAt\":\"2026-08-16T17:00:00Z\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-08-16T00:00:00Z")
                                .param("to", "2026-08-17T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].leaveByStatus").value("UNAVAILABLE"))
                .andExpect(jsonPath("$[0].leaveByReason").value("NO_DESTINATION"));

        mockMvc.perform(
                        put("/api/family/circle/calendar/MANUAL/" + eventId + "/leave-from")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"leaveFromPlaceId\":\"" + placeId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leaveFromPlaceId").value(placeId))
                .andExpect(jsonPath("$.leaveByStatus").value("OK"));

        mockMvc.perform(
                        put("/api/family/circle/calendar/MANUAL/"
                                        + eventId
                                        + "/leave-from")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"leaveFromPlaceId\":\"01900000-0000-7000-8000-000000000099\"}"))
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
