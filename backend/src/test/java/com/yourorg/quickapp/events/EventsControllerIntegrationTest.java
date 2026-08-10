package com.yourorg.quickapp.events;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
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
class EventsControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void caregiverManualEventCrudValidationAndFeedStillForbidden() throws Exception {
        String organizerToken = signIn("events-org@example.com");
        String caregiverToken = signIn("events-care@example.com");

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
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Nope\",\"sourceUrl\":\"https://example.com/other.ics\",\"kidIds\":[]}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Dentist\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"kidIds\":[]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Dentist\",\"startsAt\":\"2026-08-15T18:00:00Z\",\"endsAt\":\"2026-08-15T17:00:00Z\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Dentist\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"kidIds\":[\""
                                                + UUID.randomUUID()
                                                + "\"]}"))
                .andExpect(status().isBadRequest());

        MvcResult later =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Later\",\"startsAt\":\"2026-08-16T10:00:00Z\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.title").value("Later"))
                        .andExpect(jsonPath("$.kidIds[0]").value(kidId))
                        .andReturn();
        String laterId = JsonPath.read(later.getResponse().getContentAsString(), "$.id");

        MvcResult earlier =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Dentist\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"endsAt\":\"2026-08-15T18:00:00Z\",\"location\":\"Clinic\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.location").value("Clinic"))
                        .andReturn();
        String earlierId = JsonPath.read(earlier.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(earlierId))
                .andExpect(jsonPath("$[1].id").value(laterId));

        mockMvc.perform(
                        get("/api/family/circle/events/" + earlierId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Dentist"));

        mockMvc.perform(
                        put("/api/family/circle/events/" + earlierId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Dentist (follow-up)\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"endsAt\":null,\"location\":\"Clinic\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Dentist (follow-up)"))
                .andExpect(jsonPath("$.endsAt").value(org.hamcrest.Matchers.nullValue()));

        mockMvc.perform(
                        get("/api/family/circle/events/" + UUID.randomUUID())
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        delete("/api/family/circle/events/" + laterId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        get("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(earlierId));

        MvcResult feedCreated =
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"U12\",\"sourceUrl\":\"https://example.com/team.ics\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String feedId = JsonPath.read(feedCreated.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/feeds/" + feedId + "/sync")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk());

        mockMvc.perform(
                        get("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Dentist (follow-up)"));
    }

    @Test
    void unauthenticatedAndNoMembershipReturn401And404() throws Exception {
        mockMvc.perform(
                        get("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/family/circle/events")).andExpect(status().isUnauthorized());

        String loneToken = signIn("events-lone@example.com");
        mockMvc.perform(
                        get("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(loneToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/family/circle/events")
                                .header(HttpHeaders.AUTHORIZATION, bearer(loneToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"X\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"kidIds\":[\""
                                                + UUID.randomUUID()
                                                + "\"]}"))
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
