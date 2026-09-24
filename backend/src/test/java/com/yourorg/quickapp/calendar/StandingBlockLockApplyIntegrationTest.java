package com.yourorg.quickapp.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import java.util.List;
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

/**
 * HTTP lock → blank next-week apply for a multi-member drive block whose week-2
 * UIDs differ from week-1 (fingerprint match, not UID).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StandingBlockLockApplyIntegrationTest {

    private static final String FEED_URL =
            "https://example.com/standing-block-recurring.ics";
    private static final String HORIZON_FROM = "2026-09-01T04:00:00Z";
    /** Wide list window so assertions can see all six stub weeks after apply. */
    private static final String HORIZON_TO = "2026-11-01T04:00:00Z";
    /** 14-day Agenda-style client Lock window (must not clip known-schedule apply). */
    private static final String NARROW_HORIZON_TO = "2026-09-15T04:00:00Z";
    private static final String ZONE = "America/New_York";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void lockMultiMemberBlockAppliesCoverageOntoNextWeekBlankMatches() throws Exception {
        String token = signIn("standing-lock-apply@example.com");

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
        String adultId =
                JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");

        String kidA = addKid(token, "Sam");
        String kidB = addKid(token, "Riley");

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Mites\",\"sourceUrl\":\""
                                                + FEED_URL
                                                + "\",\"kidIds\":[\""
                                                + kidA
                                                + "\",\""
                                                + kidB
                                                + "\"]}"))
                .andExpect(status().isCreated());

        MvcResult cal =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", HORIZON_FROM)
                                        .param("to", HORIZON_TO)
                                        .param("timeZone", ZONE))
                        .andExpect(status().isOk())
                        .andReturn();
        String calBody = cal.getResponse().getContentAsString();

        @SuppressWarnings("unchecked")
        List<String> week1A =
                JsonPath.read(
                        calBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w1@example.com')].id");
        @SuppressWarnings("unchecked")
        List<String> week1B =
                JsonPath.read(
                        calBody,
                        "$.[?(@.eventKey=='UID:stub-standing-b-w1@example.com')].id");
        @SuppressWarnings("unchecked")
        List<String> week2A =
                JsonPath.read(
                        calBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w2@example.com')].id");
        @SuppressWarnings("unchecked")
        List<String> week2B =
                JsonPath.read(
                        calBody,
                        "$.[?(@.eventKey=='UID:stub-standing-b-w2@example.com')].id");
        assertThat(week1A).hasSize(1);
        assertThat(week1B).hasSize(1);
        assertThat(week2A).hasSize(1);
        assertThat(week2B).hasSize(1);
        String idA1 = week1A.getFirst();
        String idB1 = week1B.getFirst();

        @SuppressWarnings("unchecked")
        List<Object> allIds = JsonPath.read(calBody, "$[*].id");
        assertThat(allIds).hasSize(12);

        assignAndConfirmSelf(token, idA1, adultId, kidA);
        assignAndConfirmSelf(token, idB1, adultId, kidB);

        MvcResult locked =
                mockMvc.perform(
                                post("/api/family/circle/calendar/standing-blocks/lock")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"memberItemIds\":[\""
                                                        + idA1
                                                        + "\",\""
                                                        + idB1
                                                        + "\"],\"timeZone\":\""
                                                        + ZONE
                                                        + "\",\"horizonFrom\":\""
                                                        + HORIZON_FROM
                                                        + "\",\"horizonTo\":\""
                                                        + HORIZON_TO
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.members.length()").value(2))
                        .andReturn();
        String templateId = JsonPath.read(locked.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/calendar/standing-blocks")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(templateId));

        MvcResult afterLock =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", HORIZON_FROM)
                                        .param("to", HORIZON_TO)
                                        .param("timeZone", ZONE))
                        .andExpect(status().isOk())
                        .andReturn();
        String afterBody = afterLock.getResponse().getContentAsString();

        // Week-1 members must stamp standingLocked so Agenda shows Remove chrome.
        @SuppressWarnings("unchecked")
        List<Boolean> week1Locked =
                JsonPath.read(
                        afterBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w1@example.com')].standingLocked");
        @SuppressWarnings("unchecked")
        List<String> week1TemplateIds =
                JsonPath.read(
                        afterBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w1@example.com')].standingBlockTemplateId");
        assertThat(week1Locked).containsExactly(true);
        assertThat(week1TemplateIds).containsExactly(templateId);

        // Week-2 UIDs differ — fingerprint apply must still fill blank coverage.
        @SuppressWarnings("unchecked")
        List<Integer> week2ACoverageCount =
                JsonPath.read(
                        afterBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w2@example.com')].coverages.length()");
        @SuppressWarnings("unchecked")
        List<Integer> week2BCoverageCount =
                JsonPath.read(
                        afterBody,
                        "$.[?(@.eventKey=='UID:stub-standing-b-w2@example.com')].coverages.length()");
        if (week2ACoverageCount.isEmpty()
                || week2ACoverageCount.getFirst() < 1
                || week2BCoverageCount.isEmpty()
                || week2BCoverageCount.getFirst() < 1) {
            throw new AssertionError(
                    "expected week-2 coverage from apply; a="
                            + week2ACoverageCount
                            + " b="
                            + week2BCoverageCount
                            + " body="
                            + afterBody);
        }

        mockMvc.perform(
                        delete("/api/family/circle/calendar/standing-blocks/" + templateId)
                                .param("from", "2026-09-01T21:00:00Z")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        get("/api/family/circle/calendar/standing-blocks")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Remove from lock-week forward clears applied coverage on future weeks.
        MvcResult afterRemove =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", HORIZON_FROM)
                                        .param("to", HORIZON_TO)
                                        .param("timeZone", ZONE))
                        .andExpect(status().isOk())
                        .andReturn();
        String removeBody = afterRemove.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<Integer> week2Cleared =
                JsonPath.read(
                        removeBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w2@example.com')].coverages.length()");
        assertThat(week2Cleared.getFirst()).isZero();
        @SuppressWarnings("unchecked")
        List<Boolean> week2Unlocked =
                JsonPath.read(
                        removeBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w2@example.com')].standingLocked");
        assertThat(week2Unlocked).containsExactly(false);
    }

    @Test
    void lockWithFourteenDayClientWindowAppliesAcrossKnownSchedule() throws Exception {
        String token = signIn("standing-lock-known-schedule@example.com");

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
        String adultId =
                JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");

        String kidA = addKid(token, "Sam");
        String kidB = addKid(token, "Riley");

        mockMvc.perform(
                        post("/api/family/circle/feeds")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Mites\",\"sourceUrl\":\""
                                                + FEED_URL
                                                + "\",\"kidIds\":[\""
                                                + kidA
                                                + "\",\""
                                                + kidB
                                                + "\"]}"))
                .andExpect(status().isCreated());

        MvcResult cal =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", HORIZON_FROM)
                                        .param("to", HORIZON_TO)
                                        .param("timeZone", ZONE))
                        .andExpect(status().isOk())
                        .andReturn();
        String calBody = cal.getResponse().getContentAsString();

        @SuppressWarnings("unchecked")
        List<String> week1A =
                JsonPath.read(
                        calBody,
                        "$.[?(@.eventKey=='UID:stub-standing-a-w1@example.com')].id");
        @SuppressWarnings("unchecked")
        List<String> week1B =
                JsonPath.read(
                        calBody,
                        "$.[?(@.eventKey=='UID:stub-standing-b-w1@example.com')].id");
        assertThat(week1A).hasSize(1);
        assertThat(week1B).hasSize(1);
        String idA1 = week1A.getFirst();
        String idB1 = week1B.getFirst();

        assignAndConfirmSelf(token, idA1, adultId, kidA);
        assignAndConfirmSelf(token, idB1, adultId, kidB);

        // Client sends a 14-day Agenda window; server must still apply w2–w6.
        mockMvc.perform(
                        post("/api/family/circle/calendar/standing-blocks/lock")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"memberItemIds\":[\""
                                                + idA1
                                                + "\",\""
                                                + idB1
                                                + "\"],\"timeZone\":\""
                                                + ZONE
                                                + "\",\"horizonFrom\":\""
                                                + HORIZON_FROM
                                                + "\",\"horizonTo\":\""
                                                + NARROW_HORIZON_TO
                                                + "\"}"))
                .andExpect(status().isCreated());

        MvcResult afterLock =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", HORIZON_FROM)
                                        .param("to", HORIZON_TO)
                                        .param("timeZone", ZONE))
                        .andExpect(status().isOk())
                        .andReturn();
        String afterBody = afterLock.getResponse().getContentAsString();

        for (String uid :
                List.of(
                        "stub-standing-a-w2@example.com",
                        "stub-standing-a-w3@example.com",
                        "stub-standing-a-w4@example.com",
                        "stub-standing-a-w5@example.com",
                        "stub-standing-a-w6@example.com")) {
            @SuppressWarnings("unchecked")
            List<Integer> coverageCount =
                    JsonPath.read(
                            afterBody, "$.[?(@.eventKey=='UID:" + uid + "')].coverages.length()");
            if (coverageCount.isEmpty() || coverageCount.getFirst() < 1) {
                throw new AssertionError(
                        "expected known-schedule apply coverage for "
                                + uid
                                + " got "
                                + coverageCount
                                + " body="
                                + afterBody);
            }
        }
    }

    private void assignAndConfirmSelf(
            String token, String itemId, String adultId, String kidId) throws Exception {
        MvcResult assigned =
                mockMvc.perform(
                                post("/api/family/circle/calendar/FEED/" + itemId + "/coverages")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"coveringAdultId\":\""
                                                        + adultId
                                                        + "\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String status =
                JsonPath.read(assigned.getResponse().getContentAsString(), "$.coverages[0].status");
        if ("PENDING".equals(status)) {
            String assignmentId =
                    JsonPath.read(
                            assigned.getResponse().getContentAsString(), "$.coverages[0].id");
            mockMvc.perform(
                            post("/api/family/circle/calendar/coverages/"
                                            + assignmentId
                                            + "/confirm")
                                    .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk());
        }
    }

    private String addKid(String token, String name) throws Exception {
        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"" + name + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");
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
