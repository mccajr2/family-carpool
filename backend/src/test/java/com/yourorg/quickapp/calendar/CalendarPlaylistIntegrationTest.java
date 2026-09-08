package com.yourorg.quickapp.calendar;

import static org.hamcrest.Matchers.hasSize;
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
class CalendarPlaylistIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void confirmedRidePlaylistListsAttendingKidWithDesignationTracks() throws Exception {
        String token = signIn("calendar-playlist-org@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"Playlist House\"}"))
                .andExpect(status().isCreated());

        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidId = JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");

        MvcResult circle =
                mockMvc.perform(get("/api/family/circle").header(HttpHeaders.AUTHORIZATION, token))
                        .andExpect(status().isOk())
                        .andReturn();
        String adultId =
                JsonPath.read(circle.getResponse().getContentAsString(), "$.members[0].adultId");

        mockMvc.perform(
                        post("/api/family/circle/places")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Home\",\"address\":\"1 Main Street\"}"))
                .andExpect(status().isCreated());

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"vs Thunder\",\"startsAt\":\"2026-08-15T17:00:00Z\",\"location\":\"Playlist Rink\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/coverages")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"coveringAdultId\":\""
                                                + adultId
                                                + "\",\"kidIds\":[\""
                                                + kidId
                                                + "\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist")
                                .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.riders", hasSize(1)))
                .andExpect(jsonPath("$.riders[0].kidId").value(kidId))
                .andExpect(jsonPath("$.riders[0].kidDisplayName").value("Sam"))
                .andExpect(jsonPath("$.riders[0].connected").value(false))
                .andExpect(jsonPath("$.riders[0].inviteContact.channel").value("push"))
                .andExpect(jsonPath("$.riders[0].inviteContact.to").value("Playlist House"));

        connectSpotify(token);
        mockMvc.perform(
                        put("/api/playlist/designations/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-a\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist")
                                .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.riders", hasSize(1)))
                .andExpect(jsonPath("$.riders[0].connected").value(true))
                .andExpect(jsonPath("$.riders[0].playlistName").value("Sam gameday"))
                .andExpect(jsonPath("$.riders[0].trackCount").value(12))
                .andExpect(jsonPath("$.riders[0].tracks", hasSize(3)))
                .andExpect(jsonPath("$.riders[0].tracks[0].title").value("Sunset Drive"))
                .andExpect(jsonPath("$.riders[0].durationSec").value(198 + 221 + 176))
                .andExpect(jsonPath("$.riders[0].inviteContact").doesNotExist());
    }

    @Test
    void playlistForbiddenWhenNotRoutable() throws Exception {
        String token = signIn("calendar-playlist-forbidden@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidId = JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"Open skate\",\"startsAt\":\"2026-08-16T17:00:00Z\",\"kidIds\":[\""
                                                        + kidId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String eventId = JsonPath.read(eventResult.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist")
                                .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());
    }

    private void connectSpotify(String bearerToken) throws Exception {
        MvcResult authorizeResult =
                mockMvc.perform(
                                get("/api/playlist/spotify/authorize")
                                        .header(HttpHeaders.AUTHORIZATION, bearerToken))
                        .andExpect(status().isOk())
                        .andReturn();
        String state =
                authorizeResult
                        .getResponse()
                        .getContentAsString()
                        .replaceAll("(?s).*\"state\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        mockMvc.perform(
                        get("/api/playlist/spotify/callback")
                                .param("code", "good-code")
                                .param("state", state))
                .andExpect(status().isFound());
    }

    private String signIn(String email) throws Exception {
        MvcResult requestResult =
                mockMvc.perform(
                                post("/api/auth/request-code")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"email\":\"" + email + "\"}"))
                        .andExpect(status().isAccepted())
                        .andReturn();
        String code =
                requestResult
                        .getResponse()
                        .getContentAsString()
                        .replaceAll("(?s).*\"devCode\"\\s*:\\s*\"([^\"]+)\".*", "$1");
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
        return "Bearer "
                + verifyResult
                        .getResponse()
                        .getContentAsString()
                        .replaceAll("(?s).*\"accessToken\"\\s*:\\s*\"([^\"]+)\".*", "$1");
    }
}
