package com.yourorg.quickapp.calendar;

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
class CalendarPlaylistOpenIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void openHandoffZeroOneAndTwoPlusRules() throws Exception {
        String token = signIn("calendar-playlist-open@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"Open House\"}"))
                .andExpect(status().isCreated());

        String kidA = addKid(token, "Sam");
        String kidB = addKid(token, "Jordan");

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
                                .content("{\"name\":\"Home\",\"address\":\"1 Main Street\"}"))
                .andExpect(status().isCreated());

        MvcResult eventResult =
                mockMvc.perform(
                                post("/api/family/circle/events")
                                        .header(HttpHeaders.AUTHORIZATION, token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"title\":\"vs Lightning\",\"startsAt\":\"2026-08-17T17:00:00Z\",\"location\":\"Open Rink\",\"kidIds\":[\""
                                                        + kidA
                                                        + "\",\""
                                                        + kidB
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
                                                + kidA
                                                + "\",\""
                                                + kidB
                                                + "\"]}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist/open")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("No connected playlists to open in Spotify"));

        connectSpotify(token);
        mockMvc.perform(
                        put("/api/playlist/designations/" + kidA)
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-a\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist/open")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.url")
                                .value("https://open.spotify.com/playlist/stub-playlist-a"));

        mockMvc.perform(
                        put("/api/playlist/designations/" + kidB)
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-b\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist/open")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"trackUris\":[\"spotify:track:remix1\",\"spotify:track:remix2\"]}"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.url")
                                .value("https://open.spotify.com/playlist/stub-merge-playlist"));

        // Second open reuses the same merge playlist id.
        mockMvc.perform(
                        post("/api/family/circle/calendar/MANUAL/" + eventId + "/playlist/open")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.url")
                                .value("https://open.spotify.com/playlist/stub-merge-playlist"));
    }

    private String addKid(String token, String name) throws Exception {
        MvcResult kidResult =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"" + name + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return JsonPath.read(kidResult.getResponse().getContentAsString(), "$.id");
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
