package com.yourorg.quickapp.playlist;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class PlaylistDesignationIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void connectListSetChangeClearAndRevokeClearsDesignations() throws Exception {
        String token = signIn("designate-parent@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\"Pat\",\"name\":\"Designate house\"}"))
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

        mockMvc.perform(get("/api/playlist/spotify/playlists").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Spotify is not connected for this adult"));

        connectSpotify(token);

        mockMvc.perform(get("/api/playlist/spotify/playlists").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("stub-playlist-a"))
                .andExpect(jsonPath("$[1].id").value("stub-playlist-b"));

        mockMvc.perform(get("/api/playlist/designations").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(
                        put("/api/playlist/designations/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-a\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kidId").value(kidId))
                .andExpect(jsonPath("$.kidDisplayName").value("Sam"))
                .andExpect(jsonPath("$.spotifyPlaylistId").value("stub-playlist-a"))
                .andExpect(jsonPath("$.playlistName").value("Sam gameday"))
                .andExpect(jsonPath("$.trackCount").value(12));

        mockMvc.perform(
                        put("/api/playlist/designations/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-b\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spotifyPlaylistId").value("stub-playlist-b"))
                .andExpect(jsonPath("$.playlistName").value("Jordan warmup"))
                .andExpect(jsonPath("$.trackCount").value(8));

        mockMvc.perform(get("/api/playlist/designations").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].spotifyPlaylistId").value("stub-playlist-b"));

        mockMvc.perform(
                        delete("/api/playlist/designations/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/playlist/designations").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(
                        put("/api/playlist/designations/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-a\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/playlist/spotify/revoke").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/playlist/designations").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get("/api/playlist/spotify/status").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false));
    }

    @Test
    void setDesignationRejectsKidOutsideCircle() throws Exception {
        String token = signIn("designate-outsider@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Out\",\"name\":\"Other\"}"))
                .andExpect(status().isCreated());
        connectSpotify(token);

        mockMvc.perform(
                        put("/api/playlist/designations/00000000-0000-0000-0000-000000000099")
                                .header(HttpHeaders.AUTHORIZATION, token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"spotifyPlaylistId\":\"stub-playlist-a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Kid not found in this circle"));
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
        String body = requestResult.getResponse().getContentAsString();
        String code = body.replaceAll("(?s).*\"devCode\"\\s*:\\s*\"([^\"]+)\".*", "$1");

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
        String accessToken =
                verifyResult
                        .getResponse()
                        .getContentAsString()
                        .replaceAll("(?s).*\"accessToken\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        return "Bearer " + accessToken;
    }
}
