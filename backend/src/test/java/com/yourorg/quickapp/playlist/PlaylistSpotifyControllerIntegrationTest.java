package com.yourorg.quickapp.playlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class PlaylistSpotifyControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SpotifyConnectionApi spotifyConnectionApi;

    @Test
    void authorizeCallbackStatusRevokeAndRefreshHappyPath() throws Exception {
        String token = signIn("playlist-spotify@example.com");

        mockMvc.perform(get("/api/playlist/spotify/status").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false));

        MvcResult authorizeResult =
                mockMvc.perform(
                                get("/api/playlist/spotify/authorize")
                                        .header(HttpHeaders.AUTHORIZATION, token))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.authorizeUrl").isString())
                        .andExpect(jsonPath("$.state").isString())
                        .andReturn();

        String authorizeBody = authorizeResult.getResponse().getContentAsString();
        String state =
                authorizeBody.replaceAll("(?s).*\"state\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        assertThat(authorizeBody).contains("client_id=test-spotify-client-id");

        mockMvc.perform(
                        get("/api/playlist/spotify/callback")
                                .param("code", "good-code")
                                .param("state", state))
                .andExpect(status().isFound())
                .andExpect(
                        header().string(
                                HttpHeaders.LOCATION, "http://localhost:5173/?spotify=connected"));

        mockMvc.perform(get("/api/playlist/spotify/status").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.spotifyUserId").value("stub-spotify-user"));

        // Resolve adult id via a second authorize is awkward; use API isConnected after me.
        MvcResult me =
                mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, token))
                        .andExpect(status().isOk())
                        .andReturn();
        String adultId =
                me.getResponse()
                        .getContentAsString()
                        .replaceAll("(?s).*\"id\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        assertThat(spotifyConnectionApi.isConnected(java.util.UUID.fromString(adultId))).isTrue();
        assertThat(spotifyConnectionApi.accessToken(java.util.UUID.fromString(adultId)))
                .contains("stub-access-token");

        mockMvc.perform(post("/api/playlist/spotify/revoke").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/playlist/spotify/status").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false));
        assertThat(spotifyConnectionApi.isConnected(java.util.UUID.fromString(adultId))).isFalse();
        assertThat(spotifyConnectionApi.accessToken(java.util.UUID.fromString(adultId))).isEmpty();
    }

    @Test
    void authorizeRequiresBearer() throws Exception {
        mockMvc.perform(get("/api/playlist/spotify/authorize")).andExpect(status().isUnauthorized());
    }

    @Test
    void callbackRejectsUnknownState() throws Exception {
        mockMvc.perform(
                        get("/api/playlist/spotify/callback")
                                .param("code", "good-code")
                                .param("state", "not-a-real-state"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unknown or expired OAuth state"));
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
        String verifyBody = verifyResult.getResponse().getContentAsString();
        String accessToken =
                verifyBody.replaceAll("(?s).*\"accessToken\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        return "Bearer " + accessToken;
    }
}
