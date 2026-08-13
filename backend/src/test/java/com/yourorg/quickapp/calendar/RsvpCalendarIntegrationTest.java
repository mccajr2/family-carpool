package com.yourorg.quickapp.calendar;

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
class RsvpCalendarIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void setRsvpNoReleasesCoverageAndExcludesFromUncovered() throws Exception {
        String organizerToken = signIn("rsvp-org@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult circle =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                        .andExpect(status().isOk())
                        .andReturn();
        String organizerAdultId =
                JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");

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
                .andExpect(jsonPath("$[0].rsvps.length()").value(2))
                .andExpect(jsonPath("$[0].rsvps[0].status").value("NO_RESPONSE"))
                .andExpect(jsonPath("$[0].uncoveredKidIds.length()").value(2));

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + organizerAdultId
                                                + "\",\"kidIds\":[\""
                                                + kidA
                                                + "\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverages.length()").value(1))
                .andExpect(jsonPath("$.rsvps[?(@.kidId=='" + kidA + "')].status").value("YES"))
                .andExpect(jsonPath("$.uncoveredKidIds.length()").value(1));

        mockMvc.perform(
                        put("/api/family/circle/calendar/MANUAL/"
                                        + eventId
                                        + "/rsvps/"
                                        + kidA)
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"NO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverages").isEmpty())
                .andExpect(jsonPath("$.rsvps[?(@.kidId=='" + kidA + "')].status").value("NO"))
                .andExpect(jsonPath("$.uncoveredKidIds.length()").value(1))
                .andExpect(jsonPath("$.uncoveredKidIds[0]").value(kidB));

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + organizerAdultId
                                                + "\",\"kidIds\":[\""
                                                + kidA
                                                + "\"]}"))
                .andExpect(status().isBadRequest());
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
