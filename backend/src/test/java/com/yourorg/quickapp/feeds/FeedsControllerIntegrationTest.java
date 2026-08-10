package com.yourorg.quickapp.feeds;

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
class FeedsControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void organizerFeedCrudSyncSoftFailAndCaregiverForbidden() throws Exception {
        String organizerToken = signIn("feeds-org@example.com");
        String caregiverToken = signIn("feeds-care@example.com");

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

        MvcResult created =
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"U12 Travel\",\"sourceUrl\":\"webcal://example.com/team.ics\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value("U12 Travel"))
                        .andExpect(jsonPath("$.sourceUrl").value("https://example.com/team.ics"))
                        .andExpect(jsonPath("$.lastSyncedAt").isNotEmpty())
                        .andExpect(jsonPath("$.lastSyncError").value(org.hamcrest.Matchers.nullValue()))
                        .andExpect(jsonPath("$.eventCount").value(2))
                        .andExpect(jsonPath("$.kidIds[0]").value(kidId))
                        .andReturn();
        String feedId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Nope\",\"sourceUrl\":\"https://example.com/other.ics\",\"kidIds\":[]}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Dup\",\"sourceUrl\":\"https://example.com/team.ics\",\"kidIds\":[]}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Broken\",\"sourceUrl\":\"https://example.com/fail.ics\",\"kidIds\":[]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lastSyncedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.lastSyncError").isString())
                .andExpect(jsonPath("$.eventCount").value(0));

        mockMvc.perform(
                        post("/api/family/circle/feeds/" + feedId + "/sync")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventCount").value(2));

        mockMvc.perform(
                        put("/api/family/circle/feeds/" + feedId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"U12 Travel\",\"sourceUrl\":\"https://example.com/team.ics\",\"kidIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kidIds").isEmpty());

        mockMvc.perform(
                        get("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(
                        delete("/api/family/circle/feeds/" + feedId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/family/circle/feeds").header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void unauthenticatedFeedCallsReturn401() throws Exception {
        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"U12\",\"sourceUrl\":\"https://example.com/a.ics\",\"kidIds\":[]}"))
                .andExpect(status().isUnauthorized());
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
