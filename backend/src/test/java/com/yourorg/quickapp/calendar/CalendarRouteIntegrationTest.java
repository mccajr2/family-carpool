package com.yourorg.quickapp.calendar;

import static org.hamcrest.Matchers.hasSize;
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
class CalendarRouteIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void selfAssignConfirmedCoverageThenGetRouteOk() throws Exception {
        String token = signIn("calendar-route-org@example.com");

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
        String adultId = JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"vs Thunder\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"location\":\"Rink Field\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + adultId
                                                + "\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverages[0].status").value("CONFIRMED"));

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/route")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.bufferMinutes").value(45))
                .andExpect(jsonPath("$.stops", hasSize(2)))
                .andExpect(jsonPath("$.stops[0].kind").value("home"))
                .andExpect(jsonPath("$.stops[1].kind").value("destination"))
                .andExpect(jsonPath("$.legMinutes", hasSize(1)));
    }

    @Test
    void getRouteForbiddenWithoutConfirmedRide() throws Exception {
        String token = signIn("calendar-route-forbidden@example.com");

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

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Dentist\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"location\":\"Clinic\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/route")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void removeConfirmedCoverageThenGetRouteForbidden() throws Exception {
        String token = signIn("calendar-route-remove@example.com");

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
        String adultId = JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"vs Thunder\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"location\":\"Rink Field\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        MvcResult coverageResult =
                mockMvc.perform(
                                post("/api/family/circle/calendar/MANUAL/" + eventId + "/coverages")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"coveringAdultId\":\""
                                                        + adultId
                                                        + "\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.coverages[0].status").value("CONFIRMED"))
                        .andReturn();
        String assignmentId =
                JsonPath.read(coverageResult.getResponse().getContentAsString(), "$.coverages[0].id");

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/route")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"));

        mockMvc.perform(
                        delete("/api/family/circle/calendar/coverages/" + assignmentId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/route")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
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
