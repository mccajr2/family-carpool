package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import java.util.List;
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
class StandingRideMaterialiseIntegrationTest {

    private static final String FEED_URL = "https://example.com/standing-ride-series-mat.ics";
    private static final String EVENT_KEY_W1 = "UID:stub-standing-ride-w1@example.com";
    private static final String EVENT_KEY_W2 = "UID:stub-standing-ride-w2@example.com";
    private static final String ZONE = "America/New_York";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CarpoolRideRequestRepository rides;

    @Autowired
    private StandingRideMaterialiseService materialise;

    @Test
    void acceptMaterialisesBlankMatchesAndNeverOverwrites() throws Exception {
        String orgA = signIn("standing-mat-org-a@example.com");
        String orgB = signIn("standing-mat-org-b@example.com");

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

        // One-off ask on week 2 before standing Accept — must not be overwritten.
        MvcResult oneOff =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(orgA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                                {"eventKey":"%s","kidIds":["%s"],"legs":["TO","FROM"]}
                                                """
                                                        .formatted(EVENT_KEY_W2, kidA)))
                        .andExpect(status().isCreated())
                        .andReturn();
        String oneOffRideId =
                JsonPath.read(oneOff.getResponse().getContentAsString(), "$.id");

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
                                                    {"kind":"FROM","action":"ASK_TEAM"}
                                                  ]
                                                }
                                                """
                                                        .formatted(EVENT_KEY_W1, ZONE, kidA)))
                        .andExpect(status().isCreated())
                        .andReturn();
        String arrangementId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/"
                                        + spaceId
                                        + "/standing-rides/"
                                        + arrangementId
                                        + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        UUID arrangementUuid = UUID.fromString(arrangementId);
        List<CarpoolRideRequestEntity> linked =
                rides.findByArrangementIdAndStatusIn(
                        arrangementUuid, List.of(CarpoolRideStatus.ACCEPTED));
        // Feed sync horizon has the gate's ≥3 other matches; week 2 is held by the one-off.
        assertThat(linked.size()).isGreaterThanOrEqualTo(3);
        assertThat(linked)
                .allSatisfy(
                        ride -> {
                            assertThat(ride.status()).isEqualTo(CarpoolRideStatus.ACCEPTED);
                            assertThat(ride.arrangementId()).isEqualTo(arrangementUuid);
                            assertThat(ride.eventKey()).isNotEqualTo(EVENT_KEY_W2);
                            assertThat(ride.acceptedByAdultId()).isNotNull();
                            assertThat(ride.acceptingCircleId()).isNotNull();
                        });
        assertThat(linked.stream().map(CarpoolRideRequestEntity::eventKey))
                .contains(EVENT_KEY_W1);

        // Week 2 one-off stays PENDING and is not linked to the arrangement.
        assertThat(rides.findById(UUID.fromString(oneOffRideId)))
                .isPresent()
                .get()
                .satisfies(
                        ride -> {
                            assertThat(ride.status()).isEqualTo(CarpoolRideStatus.PENDING);
                            assertThat(ride.arrangementId()).isNull();
                            assertThat(ride.eventKey()).isEqualTo(EVENT_KEY_W2);
                        });

        // Re-apply is idempotent (never overwrite materialised weeks).
        int again =
                materialise.materialiseArrangement(UUID.fromString(spaceId), arrangementUuid);
        assertThat(again).isEqualTo(0);
        assertThat(
                        rides.findByArrangementIdAndStatusIn(
                                arrangementUuid, List.of(CarpoolRideStatus.ACCEPTED)))
                .hasSize(linked.size());
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
