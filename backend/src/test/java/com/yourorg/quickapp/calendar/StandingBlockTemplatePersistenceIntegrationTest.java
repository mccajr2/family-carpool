package com.yourorg.quickapp.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.calendar.internal.StandingBlockTemplateService;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
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
class StandingBlockTemplatePersistenceIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StandingBlockTemplateService templateService;

    @Test
    void saveListFindAndDeleteRoundTrip() throws Exception {
        String token = signIn("standing-block-template@example.com");
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

        UUID feedId = UUID.randomUUID();
        RecurringFeedFingerprint fpA =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        RecurringFeedFingerprint fpB =
                new RecurringFeedFingerprint(
                        UUID.randomUUID(), DayOfWeek.TUESDAY, 18 * 60, "school");

        StandingBlockMemberSnapshotDto memberA =
                new StandingBlockMemberSnapshotDto(
                        fpA,
                        0,
                        List.of(
                                new StandingCoverageSnapshotDto(
                                        adultId,
                                        adultId,
                                        CoverageStatus.CONFIRMED,
                                        List.of(kidId),
                                        null,
                                        null)),
                        List.of(
                                new StandingRidePlanSnapshotDto(
                                        List.of(kidId),
                                        List.of(
                                                new StandingRidePlanLegSnapshotDto(
                                                        CarpoolLegKind.TO,
                                                        CarpoolLegPhase.CONFIRMED,
                                                        adultId,
                                                        circleId,
                                                        null,
                                                        "Home",
                                                        "1 Main",
                                                        CarpoolMeetSide.REQUESTER),
                                                new StandingRidePlanLegSnapshotDto(
                                                        CarpoolLegKind.FROM,
                                                        CarpoolLegPhase.WAITING_HOUSEHOLD,
                                                        adultId,
                                                        circleId,
                                                        null,
                                                        null,
                                                        null,
                                                        null)))),
                        List.of(
                                new StandingRouteOriginSnapshotDto(
                                        adultId, CarpoolLegKind.TO, null, null, "1 Main")));
        StandingBlockMemberSnapshotDto memberB =
                new StandingBlockMemberSnapshotDto(
                        fpB,
                        1,
                        List.of(
                                new StandingCoverageSnapshotDto(
                                        adultId,
                                        adultId,
                                        CoverageStatus.PENDING,
                                        List.of(kidId),
                                        null,
                                        null)),
                        List.of(),
                        List.of());

        StandingBlockTemplateDto saved =
                templateService.save(circleId, adultId, List.of(memberA, memberB));
        assertThat(saved.id()).isNotNull();
        assertThat(saved.members()).hasSize(2);
        assertThat(saved.members().get(0).fingerprint()).isEqualTo(fpA);
        assertThat(saved.members().get(1).fingerprint()).isEqualTo(fpB);
        assertThat(saved.members().get(0).coverages()).hasSize(1);
        assertThat(saved.members().get(0).ridePlans()).hasSize(1);
        assertThat(saved.members().get(0).routeOrigins())
                .singleElement()
                .satisfies(o -> assertThat(o.leaveFromAddress()).isEqualTo("1 Main"));

        assertThat(templateService.listForCircle(circleId)).hasSize(1);
        assertThat(templateService.findByCircleAndFingerprints(circleId, List.of(fpA, fpB)))
                .isPresent()
                .get()
                .satisfies(dto -> assertThat(dto.id()).isEqualTo(saved.id()));

        // Replace same fingerprint set — same template id, refreshed snapshots
        StandingBlockMemberSnapshotDto memberAUpdated =
                new StandingBlockMemberSnapshotDto(
                        fpA,
                        0,
                        List.of(
                                new StandingCoverageSnapshotDto(
                                        adultId,
                                        adultId,
                                        CoverageStatus.CONFIRMED,
                                        List.of(kidId),
                                        null,
                                        "One-time")),
                        List.of(),
                        List.of());
        StandingBlockTemplateDto replaced =
                templateService.save(circleId, adultId, List.of(memberAUpdated, memberB));
        assertThat(replaced.id()).isEqualTo(saved.id());
        assertThat(replaced.members().get(0).coverages().getFirst().leaveFromAddress())
                .isEqualTo("One-time");
        assertThat(templateService.listForCircle(circleId)).hasSize(1);

        assertThat(templateService.delete(circleId, saved.id())).isTrue();
        assertThat(templateService.listForCircle(circleId)).isEmpty();
        assertThat(templateService.delete(circleId, saved.id())).isFalse();
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
