package com.yourorg.quickapp.calendar;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class DriveBlockOverrideApiIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void setAndClearOverrideRoundTripReturnsBothItems() throws Exception {
        String token = signIn("drive-block-api@example.com");

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

        MvcResult leftResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Practice A\",\"startsAt\":\"2026-09-15T17:00:00Z\",\"endsAt\":\"2026-09-15T18:00:00Z\",\"location\":\"Rink\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String leftId = JsonPath.read(leftResult.getResponse().getContentAsString(), "$.id");

        MvcResult rightResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Practice B\",\"startsAt\":\"2026-09-15T18:00:00Z\",\"endsAt\":\"2026-09-15T19:00:00Z\",\"location\":\"Rink\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String rightId = JsonPath.read(rightResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        put("/api/family/circle/calendar/drive-block-overrides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"leg\":\"TO\",\"leftSource\":\"MANUAL\",\"leftItemId\":\""
                                                + leftId
                                                + "\",\"rightSource\":\"MANUAL\",\"rightItemId\":\""
                                                + rightId
                                                + "\",\"action\":\"FORCE_MERGE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(leftId))
                .andExpect(jsonPath("$[1].id").value(rightId))
                .andExpect(jsonPath("$[0].driveBlockLinks").isArray())
                .andExpect(jsonPath("$[1].driveBlockLinks").isArray());

        mockMvc.perform(
                        get("/api/family/circle/calendar")
                                .param("from", "2026-09-01T00:00:00Z")
                                .param("to", "2026-10-01T00:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].driveBlockLinks").isArray());

        mockMvc.perform(
                        delete("/api/family/circle/calendar/drive-block-overrides")
                                .param("leg", "TO")
                                .param("leftSource", "MANUAL")
                                .param("leftItemId", leftId)
                                .param("rightSource", "MANUAL")
                                .param("rightItemId", rightId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(
                        put("/api/family/circle/calendar/drive-block-overrides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"leg\":\"TO\",\"leftSource\":\"MANUAL\",\"leftItemId\":\""
                                                + leftId
                                                + "\",\"rightSource\":\"MANUAL\",\"rightItemId\":\""
                                                + leftId
                                                + "\",\"action\":\"FORCE_SPLIT\"}"))
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
