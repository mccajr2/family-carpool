package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.carpool.internal.StandingRideArrangementService;
import java.time.Instant;
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
class StandingRideAskApiIntegrationTest {

    private static final String FEED_URL = "https://example.com/standing-ride-series.ics";
    private static final String EVENT_KEY = "UID:stub-standing-ride-w1@example.com";
    private static final String ZONE = "America/New_York";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StandingRideArrangementService arrangementService;

    @Test
    void createAcceptPassEndAndUnansweredExpire() throws Exception {
        String orgA = signIn("standing-ask-org-a@example.com");
        String orgB = signIn("standing-ask-org-b@example.com");

        createCircle(orgA, "Alex", "House A");
        createCircle(orgB, "Sam", "House B");
        String kidA = addKid(orgA, "Sam");
        String kidB = addKid(orgB, "Riley");
        String feedA = createFeed(orgA, "Soccer", FEED_URL, kidA);
        createFeed(orgB, "Soccer", FEED_URL, kidB);

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
        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());

        addPlace(orgA, "Home A", "12 Oak St");
        addPlace(orgB, "Home B", "34 Pine St");

        MvcResult created =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/standing-rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                                {
                                                  "eventKey":"%s",
                                                  "timeZone":"%s",
                                                  "kidIds":["%s"],
                                                  "legs":[
                                                    {"kind":"TO","action":"ASK_TEAM"},
                                                    {"kind":"FROM","action":"ASK_TEAM","meetSide":"ACCEPTOR"}
                                                  ]
                                                }
                                                """
                                                        .formatted(EVENT_KEY, ZONE, kidA)))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("OPEN"))
                        .andExpect(jsonPath("$.assignment").value("FIXED_PRIMARY"))
                        .andExpect(jsonPath("$.askTemplate.legs[1].meetSide").value("ACCEPTOR"))
                        .andReturn();
        String arrangementId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/standing-rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "eventKey":"%s",
                                          "timeZone":"%s",
                                          "kidIds":["%s"],
                                          "legs":[
                                            {"kind":"TO","action":"ASK_TEAM"},
                                            {"kind":"FROM","action":"ASK_TEAM"}
                                          ]
                                        }
                                        """
                                                .formatted(EVENT_KEY, ZONE, kidA)))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/standing-rides/"
                                        + arrangementId
                                        + "/pass")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passedByMe").value(true))
                .andExpect(jsonPath("$.status").value("OPEN"));

        mockMvc.perform(
                        get("/api/carpool/spaces/" + spaceId + "/standing-rides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].passedByMe").value(true));

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/standing-rides/"
                                        + arrangementId
                                        + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.primaryAdultId").isNotEmpty())
                .andExpect(jsonPath("$.primaryCircleId").isNotEmpty());

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/standing-rides/"
                                        + arrangementId
                                        + "/end")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/standing-rides/"
                                        + arrangementId
                                        + "/end")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENDED"));

        // Unanswered expire: new OPEN with past-due anchor → ended on list/expire.
        MvcResult recreated =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/standing-rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                                {
                                                  "eventKey":"%s",
                                                  "timeZone":"%s",
                                                  "kidIds":["%s"],
                                                  "legs":[
                                                    {"kind":"TO","action":"ASK_TEAM"},
                                                    {"kind":"FROM","action":"NEEDS_RIDE"}
                                                  ]
                                                }
                                                """
                                                        .formatted(EVENT_KEY, ZONE, kidA)))
                        .andExpect(status().isCreated())
                        .andReturn();
        UUID openId =
                UUID.fromString(JsonPath.read(recreated.getResponse().getContentAsString(), "$.id"));
        // Force anchor into the past via service expire with "now" after local day start.
        assertThat(
                        arrangementService.expireOpenIfDue(
                                UUID.fromString(spaceId), Instant.parse("2026-12-01T05:00:00Z")))
                .isEqualTo(1);
        assertThat(arrangementService.findBySpaceAndId(UUID.fromString(spaceId), openId))
                .isPresent()
                .get()
                .satisfies(dto -> assertThat(dto.status()).isEqualTo(StandingRideArrangementStatus.ENDED));
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

    private void createCircle(String token, String adultName, String house) throws Exception {
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\""
                                                + adultName
                                                + "\",\"name\":\""
                                                + house
                                                + "\"}"))
                .andExpect(status().isCreated());
    }

    private String addKid(String token, String name) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"" + name + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }

    private String createFeed(String token, String name, String url, String kidId) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"sourceUrl\":\""
                                                        + url
                                                        + "\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }

    private void addPlace(String token, String name, String address) throws Exception {
        mockMvc.perform(
                        post("/api/family/circle/places")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\""
                                                + name
                                                + "\",\"address\":\""
                                                + address
                                                + "\"}"))
                .andExpect(status().isCreated());
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
