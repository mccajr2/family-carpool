package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.feeds.FeedsApi;
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
class CarpoolControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FeedsApi feedsApi;

    @Test
    void unauthenticatedCarpoolCallsReturn401() throws Exception {
        mockMvc.perform(get("/api/carpool")).andExpect(status().isUnauthorized());
        mockMvc.perform(
                        post("/api/carpool/enable")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"feedId\":\"01900000-0000-7000-8000-000000000041\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(
                        get("/api/carpool/spaces/01900000-0000-7000-8000-000000000080/rides")
                                .param("from", "2026-08-01T00:00:00Z")
                                .param("to", "2026-08-31T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void enableUniquenessRequestAdmitLeaveAndCaregiverForbidden() throws Exception {
        String orgA = signIn("carpool-org-a@example.com");
        String careA = signIn("carpool-care-a@example.com");
        String orgB = signIn("carpool-org-b@example.com");

        createCircle(orgA, "Alex", "House A");
        joinCircle(careA, inviteCode(orgA), "Jordan");
        createCircle(orgB, "Sam", "House B");

        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-team.ics");
        String feedB = createFeed(orgB, "Soccer", "https://example.com/carpool-team.ics");

        mockMvc.perform(
                        post("/api/carpool/enable")
                                .header(HttpHeaders.AUTHORIZATION, bearer(careA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"feedId\":\"" + feedA + "\"}"))
                .andExpect(status().isForbidden());

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedA + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.membership").value("OWNER"))
                        .andExpect(jsonPath("$.name").value("Soccer"))
                        .andExpect(jsonPath("$.inviteCode").isString())
                        .andExpect(jsonPath("$.pendingRequests").isEmpty())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String code = JsonPath.read(enabled.getResponse().getContentAsString(), "$.inviteCode");

        mockMvc.perform(
                        post("/api/carpool/enable")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"feedId\":\"" + feedA + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/carpool/enable")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"feedId\":\"" + feedB + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/carpool").header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.circleRole").value("ORGANIZER"))
                .andExpect(jsonPath("$.feeds[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$.feeds[0].spaceId").value(spaceId))
                .andExpect(jsonPath("$.feeds[0].spaceName").value("Soccer"))
                .andExpect(jsonPath("$.spaces").isEmpty());

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isNotFound());

        MvcResult requested =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/requests")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.circleName").value("House B"))
                        .andExpect(jsonPath("$.requestedByDisplayName").value("Sam"))
                        .andReturn();
        String requestId = JsonPath.read(requested.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/requests")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/carpool").header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(jsonPath("$.feeds[0].status").value("REQUESTED"));

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/requests/" + requestId + "/admit")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/requests/" + requestId + "/admit")
                                .header(HttpHeaders.AUTHORIZATION, bearer(careA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(2));

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.membership").value("MEMBER"))
                .andExpect(jsonPath("$.inviteCode").value(code))
                .andExpect(jsonPath("$.pendingRequests").isEmpty());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/invite/regenerate")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/leave")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/leave")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/requests")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isCreated());
        String declineId =
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/carpool/spaces/" + spaceId)
                                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.pendingRequests[0].id");
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/requests/" + declineId + "/decline")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isNoContent());
        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/requests")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/leave")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        post("/api/carpool/enable")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"feedId\":\"" + feedA + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void joinByCodeEnsureFeedCaregiverAndUnknownCode() throws Exception {
        String orgA = signIn("carpool-join-org@example.com");
        String careC = signIn("carpool-join-care@example.com");
        String orgC = signIn("carpool-join-org-c@example.com");
        String lone = signIn("carpool-join-lone@example.com");

        createCircle(orgA, "Alex", "House A");
        createCircle(orgC, "Casey", "House C");
        joinCircle(careC, inviteCode(orgC), "Riley");

        String feedA = createFeed(orgA, "Soccer", "https://example.com/carpool-join-team.ics");
        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedA + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String code = JsonPath.read(enabled.getResponse().getContentAsString(), "$.inviteCode");

        UUID circleC = circleId(orgC);
        assertThat(feedsApi.listByCircle(circleC)).isEmpty();

        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(careC))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.membership").value("MEMBER"))
                .andExpect(jsonPath("$.id").value(spaceId));

        assertThat(feedsApi.listByCircle(circleC))
                .hasSize(1)
                .first()
                .satisfies(
                        feed -> {
                            assertThat(feed.sourceUrl())
                                    .isEqualTo("https://example.com/carpool-join-team.ics");
                            assertThat(feed.name()).isEqualTo("Soccer");
                            assertThat(feed.kidIds()).isEmpty();
                            assertThat(feed.eventCount()).isEqualTo(2);
                        });

        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(careC))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgC))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(lone))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"NOPECODE\"}"))
                .andExpect(status().isNotFound());

        String newCode =
                JsonPath.read(
                        mockMvc.perform(
                                        post("/api/carpool/spaces/"
                                                        + spaceId
                                                        + "/invite/regenerate")
                                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.code");
        assertThat(newCode).isNotEqualTo(code);

        String orgD = signIn("carpool-join-org-d@example.com");
        createCircle(orgD, "Drew", "House D");
        createFeed(orgD, "Soccer copy", "https://example.com/carpool-join-team.ics");
        UUID circleD = circleId(orgD);
        assertThat(feedsApi.listByCircle(circleD)).hasSize(1);

        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgD))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgD))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + newCode + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.membership").value("MEMBER"));
        assertThat(feedsApi.listByCircle(circleD)).hasSize(1);

        String laxId = createFeed(orgA, "Lacrosse", "https://example.com/carpool-lax.ics");
        mockMvc.perform(
                        post("/api/carpool/enable")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"feedId\":\"" + laxId + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Lacrosse"));
        mockMvc.perform(get("/api/carpool").header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(jsonPath("$.spaces.length()").value(2));
    }

    private void createCircle(String token, String displayName, String name) throws Exception {
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\""
                                                + displayName
                                                + "\",\"name\":\""
                                                + name
                                                + "\"}"))
                .andExpect(status().isCreated());
    }

    private void joinCircle(String token, String code, String displayName) throws Exception {
        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\""
                                                + displayName
                                                + "\"}"))
                .andExpect(status().isOk());
    }

    private String inviteCode(String organizerToken) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                get("/api/family/circle/invite")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.code");
    }

    private String createFeed(String token, String name, String url) throws Exception {
        MvcResult created =
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"sourceUrl\":\""
                                                        + url
                                                        + "\",\"kidIds\":[]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
    }

    private UUID circleId(String token) throws Exception {
        return UUID.fromString(
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle")
                                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.id"));
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
