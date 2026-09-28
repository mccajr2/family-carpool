package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.carpool.internal.CarpoolException;
import com.yourorg.quickapp.carpool.internal.StandingRideArrangementService;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class StandingRideArrangementPersistenceIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StandingRideArrangementService arrangementService;

    @Test
    void createActivateEndAndDuplicateRoundTrip() throws Exception {
        String token = signIn("standing-ride-arrangement@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult circle =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                        .andExpect(status().isOk())
                        .andReturn();
        UUID circleId =
                UUID.fromString(JsonPath.read(circle.getResponse().getContentAsString(), "$.id"));
        UUID adultId =
                UUID.fromString(
                        JsonPath.read(
                                circle.getResponse().getContentAsString(),
                                "$.members[0].adultId"));

        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        UUID kidId =
                UUID.fromString(JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id"));

        MvcResult feedResult =
                mockMvc.perform(
                                post("/api/family/circle/feeds")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Soccer\",\"sourceUrl\":\"https://example.com/standing-ride.ics\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        UUID feedId =
                UUID.fromString(JsonPath.read(feedResult.getResponse().getContentAsString(), "$.id"));

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedId + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        UUID spaceId =
                UUID.fromString(JsonPath.read(enabled.getResponse().getContentAsString(), "$.id"));

        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "Rink A");
        StandingRideAskTemplateDto ask =
                new StandingRideAskTemplateDto(
                        List.of(new StandingRideAskKidDto(kidId, "Sam")),
                        List.of(
                                new StandingRideAskLegDto(
                                        CarpoolLegKind.TO,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        null,
                                        null,
                                        "Home",
                                        "12 Oak",
                                        CarpoolMeetSide.REQUESTER),
                                new StandingRideAskLegDto(
                                        CarpoolLegKind.FROM,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        null,
                                        "99 Sideline",
                                        "Field",
                                        "99 Sideline",
                                        CarpoolMeetSide.ACCEPTOR)));

        StandingRideArrangementDto created =
                arrangementService.create(
                        spaceId,
                        circleId,
                        adultId,
                        fp,
                        "America/New_York",
                        Instant.parse("2026-09-29T21:00:00Z"),
                        ask);
        assertThat(created.id()).isNotNull();
        assertThat(created.status()).isEqualTo(StandingRideArrangementStatus.OPEN);
        assertThat(created.assignment()).isEqualTo(StandingRideAssignment.FIXED_PRIMARY);
        assertThat(created.fingerprint()).isEqualTo(fp);
        assertThat(created.askTemplate().kids())
                .singleElement()
                .satisfies(
                        k -> {
                            assertThat(k.kidId()).isEqualTo(kidId);
                            assertThat(k.firstName()).isEqualTo("Sam");
                        });
        assertThat(created.askTemplate().legs()).hasSize(2);
        assertThat(created.askTemplate().legs().get(1).oneTimeAddress()).isEqualTo("99 Sideline");
        assertThat(created.askTemplate().legs().get(1).meetSide())
                .isEqualTo(CarpoolMeetSide.ACCEPTOR);

        assertThat(arrangementService.findBySpaceAndId(spaceId, created.id()))
                .isPresent()
                .get()
                .satisfies(dto -> assertThat(dto.id()).isEqualTo(created.id()));
        assertThat(arrangementService.findNonEnded(spaceId, circleId, fp))
                .isPresent()
                .get()
                .satisfies(dto -> assertThat(dto.id()).isEqualTo(created.id()));
        assertThat(arrangementService.listNonEndedForSpace(spaceId)).hasSize(1);

        assertThatThrownBy(
                        () ->
                                arrangementService.create(
                                        spaceId,
                                        circleId,
                                        adultId,
                                        fp,
                                        "America/New_York",
                                        Instant.parse("2026-09-29T21:00:00Z"),
                                        ask))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex ->
                                assertThat(((CarpoolException) ex).status())
                                        .isEqualTo(HttpStatus.CONFLICT));

        UUID primaryAdult = adultId;
        UUID primaryCircle = circleId;
        StandingRideArrangementDto active =
                arrangementService.activate(spaceId, created.id(), primaryAdult, primaryCircle);
        assertThat(active.status()).isEqualTo(StandingRideArrangementStatus.ACTIVE);
        assertThat(active.primaryAdultId()).isEqualTo(primaryAdult);
        assertThat(active.primaryCircleId()).isEqualTo(primaryCircle);

        StandingRideArrangementDto ended = arrangementService.end(spaceId, created.id());
        assertThat(ended.status()).isEqualTo(StandingRideArrangementStatus.ENDED);
        assertThat(ended.primaryAdultId()).isNull();
        assertThat(ended.endedAt()).isNotNull();
        assertThat(arrangementService.findNonEnded(spaceId, circleId, fp)).isEmpty();
        assertThat(arrangementService.listNonEndedForSpace(spaceId)).isEmpty();
        assertThat(arrangementService.listForSpace(spaceId)).hasSize(1);

        // After ENDED, a new OPEN arrangement for the same fingerprint is allowed.
        StandingRideArrangementDto recreated =
                arrangementService.create(
                        spaceId,
                        circleId,
                        adultId,
                        fp,
                        "America/New_York",
                        Instant.parse("2026-09-29T21:00:00Z"),
                        ask);
        assertThat(recreated.id()).isNotEqualTo(created.id());
        assertThat(recreated.status()).isEqualTo(StandingRideArrangementStatus.OPEN);
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
