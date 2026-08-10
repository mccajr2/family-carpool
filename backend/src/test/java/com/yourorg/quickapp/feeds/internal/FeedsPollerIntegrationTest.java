package com.yourorg.quickapp.feeds.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class FeedsPollerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FeedsService feedsService;

    @Autowired
    private ActivityFeedRepository feeds;

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void pollDisabledInTestsAndPollAllResyncsStubFeeds() throws Exception {
        assertThat(applicationContext.getBeanNamesForType(FeedsPoller.class)).isEmpty();

        int before = feeds.findAllByOrderByCreatedAtAsc().size();

        String token = signIn("feeds-poll@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"U12\",\"sourceUrl\":\"https://example.com/team.ics\",\"kidIds\":[]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Fail\",\"sourceUrl\":\"https://example.com/fail.ics\",\"kidIds\":[]}"))
                .andExpect(status().isCreated());

        int attempted = feedsService.pollAllFeeds();
        assertThat(attempted).isEqualTo(before + 2);
    }

    @Test
    void concurrentPollFeedOnSameFeedDoesNotThrow() throws Exception {
        String token = signIn("feeds-race@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult created =
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"U12\",\"sourceUrl\":\"https://example.com/team.ics\",\"kidIds\":[]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        java.util.UUID feedId =
                java.util.UUID.fromString(
                        JsonPath.read(created.getResponse().getContentAsString(), "$.id"));

        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> feedsService.pollFeed(feedId));
            var second = pool.submit(() -> feedsService.pollFeed(feedId));
            first.get(30, java.util.concurrent.TimeUnit.SECONDS);
            second.get(30, java.util.concurrent.TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        ActivityFeedEntity feed = feeds.findById(feedId).orElseThrow();
        assertThat(feed.lastSyncError()).isNull();
        assertThat(feed.lastSyncedAt()).isNotNull();
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
