package com.yourorg.quickapp.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * Accept of a pending ask must change driving-block membership on the next
 * calendar read with no explicit re-merge. Override split/clear is covered here
 * on the same FEED pair so links are asserted (manual events never enrich).
 */
@SpringBootTest
@AutoConfigureMockMvc
class DriveBlockAcceptMembershipIntegrationTest {

    private static final String FROM = "2026-08-01T00:00:00Z";
    private static final String TO = "2026-09-01T00:00:00Z";
    private static final String FEED_URL = "https://example.com/drive-block-membership.ics";
    private static final String EVENT_A = "UID:stub-drive-block-a@example.com";
    private static final String EVENT_B = "UID:stub-drive-block-b@example.com";

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void acceptPendingAskMergesIntoBlockOnNextCalendarRead_andOverrideSplitClears()
            throws Exception {
        String driver = signIn("drive-block-accept-driver@example.com");
        String requester = signIn("drive-block-accept-requester@example.com");

        createCircle(driver, "Alex", "House Driver");
        createCircle(requester, "Sam", "House Requester");

        String driverKid = addKid(driver, "Riley");
        String requesterKid = addKid(requester, "Sam");
        String feedDriver = createFeed(driver, "Hockey", FEED_URL, driverKid);
        createFeed(requester, "Hockey", FEED_URL, requesterKid);

        MvcResult enabled =
                mockMvc.perform(
                                post("/api/carpool/enable")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"feedId\":\"" + feedDriver + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String spaceId = JsonPath.read(enabled.getResponse().getContentAsString(), "$.id");
        String code = JsonPath.read(enabled.getResponse().getContentAsString(), "$.inviteCode");
        mockMvc.perform(
                        post("/api/carpool/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());

        String practiceA = feedEventId(driver, "Practice A");
        String practiceB = feedEventId(driver, "Practice B");
        String practiceARequester = feedEventId(requester, "Practice A");
        String practiceBRequester = feedEventId(requester, "Practice B");
        setRsvpYes(driver, practiceA, driverKid);
        setRsvpYes(driver, practiceB, driverKid);
        setRsvpYes(requester, practiceARequester, requesterKid);
        setRsvpYes(requester, practiceBRequester, requesterKid);
        addPlace(driver, "Home A", "12 Oak St");
        addPlace(requester, "Home B", "34 Pine St");

        String driverAdultId = organizerAdultId(driver);
        assertThat(driverAdultId).isNotBlank();

        // Warm geocode_cache so cheapVenueDrives can share venue identity.
        mockMvc.perform(
                        get("/api/family/circle/calendar/leave-by")
                                .param("from", FROM)
                                .param("to", TO)
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk());

        MvcResult rideACreated =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_A + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andReturn();
        String rideAId = JsonPath.read(rideACreated.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideAId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        MvcResult beforeSecond =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .param("from", FROM)
                                        .param("to", TO)
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<Object> linksBefore =
                JsonPath.read(
                        beforeSecond.getResponse().getContentAsString(),
                        "$.[?(@.id=='" + practiceA + "')].driveBlockLinks");
        assertThat(linksBefore).singleElement().asList().isEmpty();

        MvcResult rideBCreated =
                mockMvc.perform(
                                post("/api/carpool/spaces/" + spaceId + "/rides")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(requester))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"eventKey\":\"" + EVENT_B + "\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("PENDING"))
                        .andReturn();
        String rideBId = JsonPath.read(rideBCreated.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/carpool/spaces/" + spaceId + "/rides/" + rideBId + "/accept")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        MvcResult afterAccept =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .param("from", FROM)
                                        .param("to", TO)
                                        .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                        .andExpect(status().isOk())
                        .andReturn();
        String calendarJson = afterAccept.getResponse().getContentAsString();
        @SuppressWarnings("unchecked")
        List<Boolean> aCombined =
                JsonPath.read(
                        calendarJson,
                        "$.[?(@.id=='" + practiceA + "')].driveBlockLinks[?(@.leg=='TO')].combined");
        @SuppressWarnings("unchecked")
        List<String> aOther =
                JsonPath.read(
                        calendarJson,
                        "$.[?(@.id=='" + practiceA + "')].driveBlockLinks[?(@.leg=='TO')].otherId");
        assertThat(aCombined).containsExactly(true);
        assertThat(aOther).containsExactly(practiceB);

        mockMvc.perform(
                        put("/api/family/circle/calendar/drive-block-overrides")
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"leg\":\"TO\",\"leftSource\":\"FEED\",\"leftItemId\":\""
                                                + practiceA
                                                + "\",\"rightSource\":\"FEED\",\"rightItemId\":\""
                                                + practiceB
                                                + "\",\"action\":\"FORCE_SPLIT\"}"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$[?(@.id=='"
                                                + practiceA
                                                + "')].driveBlockLinks[?(@.leg=='TO')].combined")
                                .value(false))
                .andExpect(
                        jsonPath(
                                        "$[?(@.id=='"
                                                + practiceA
                                                + "')].driveBlockLinks[?(@.leg=='TO')].overrideAction")
                                .value("FORCE_SPLIT"));

        mockMvc.perform(
                        delete("/api/family/circle/calendar/drive-block-overrides")
                                .param("leg", "TO")
                                .param("leftSource", "FEED")
                                .param("leftItemId", practiceA)
                                .param("rightSource", "FEED")
                                .param("rightItemId", practiceB)
                                .header(HttpHeaders.AUTHORIZATION, bearer(driver)))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                        "$[?(@.id=='"
                                                + practiceA
                                                + "')].driveBlockLinks[?(@.leg=='TO')].combined")
                                .value(true));
    }

    private String organizerAdultId(String token) throws Exception {
        MvcResult circle =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> ids =
                JsonPath.read(
                        circle.getResponse().getContentAsString(),
                        "$.members[?(@.role=='ORGANIZER')].adultId");
        assertThat(ids).isNotEmpty();
        return ids.getFirst();
    }

    private String feedEventId(String token, String title) throws Exception {
        MvcResult calendar =
                mockMvc.perform(
                                get("/api/family/circle/calendar")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .param("from", FROM)
                                        .param("to", TO))
                        .andExpect(status().isOk())
                        .andReturn();
        @SuppressWarnings("unchecked")
        List<String> ids =
                JsonPath.read(
                        calendar.getResponse().getContentAsString(),
                        "$.[?(@.title=='" + title + "')].id");
        assertThat(ids).isNotEmpty();
        return ids.getFirst();
    }

    private void setRsvpYes(String token, String itemId, String kidId) throws Exception {
        mockMvc.perform(
                        put("/api/family/circle/calendar/FEED/" + itemId + "/rsvps/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"YES\"}"))
                .andExpect(status().isOk());
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

    private String addKid(String token, String displayName) throws Exception {
        return JsonPath.read(
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"" + displayName + "\"}"))
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.latitude").isNumber());
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
