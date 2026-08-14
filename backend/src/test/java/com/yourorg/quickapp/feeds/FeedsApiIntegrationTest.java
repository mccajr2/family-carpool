package com.yourorg.quickapp.feeds;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class FeedsApiIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FeedsApi feedsApi;

    @Test
    void ensureFeedIsIdempotentAndHttpMutationsStayOrganizerOnly() throws Exception {
        String organizerToken = signIn("feeds-api-org@example.com");
        String caregiverToken = signIn("feeds-api-care@example.com");

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

        UUID circleId =
                UUID.fromString(
                        JsonPath.read(
                                mockMvc.perform(
                                                get("/api/family/circle")
                                                        .header(
                                                                HttpHeaders.AUTHORIZATION,
                                                                bearer(caregiverToken)))
                                        .andExpect(status().isOk())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString(),
                                "$.id"));

        FeedResponse created =
                feedsApi.ensureFeed(
                        circleId, "webcal://example.com/carpool-join.ics", "Soccer - Crossbar");
        assertThat(created.name()).isEqualTo("Soccer - Crossbar");
        assertThat(created.sourceUrl()).isEqualTo("https://example.com/carpool-join.ics");
        assertThat(created.kidIds()).isEmpty();
        assertThat(created.eventCount()).isEqualTo(2);
        assertThat(created.lastSyncError()).isNull();

        FeedResponse again =
                feedsApi.ensureFeed(
                        circleId, "https://example.com/carpool-join.ics", "Different name");
        assertThat(again.id()).isEqualTo(created.id());
        assertThat(again.name()).isEqualTo("Soccer - Crossbar");
        assertThat(again.kidIds()).isEmpty();

        assertThat(feedsApi.listByCircle(circleId))
                .extracting(FeedResponse::id)
                .contains(created.id());
        assertThat(
                        feedsApi.findByCircleAndNormalizedUrl(
                                circleId, "webcal://example.com/carpool-join.ics"))
                .isPresent()
                .get()
                .extracting(FeedResponse::id)
                .isEqualTo(created.id());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Nope\",\"sourceUrl\":\"https://example.com/other-join.ics\",\"kidIds\":[]}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        post("/api/family/circle/feeds/" + created.id() + "/sync")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Dup\",\"sourceUrl\":\"https://example.com/carpool-join.ics\",\"kidIds\":[]}"))
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
