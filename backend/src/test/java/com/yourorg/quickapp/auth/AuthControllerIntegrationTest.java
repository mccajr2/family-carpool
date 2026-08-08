package com.yourorg.quickapp.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yourorg.quickapp.PostgresTestcontainers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void requestVerifyMeAndLogoutHappyPath() throws Exception {
        String email = "parent@example.com";

        MvcResult requestResult =
                mockMvc.perform(
                                post("/api/auth/request-code")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"email\":\"" + email + "\"}"))
                        .andExpect(status().isAccepted())
                        .andExpect(jsonPath("$.email").value(email))
                        .andExpect(jsonPath("$.expiresInSeconds").value(600))
                        .andExpect(jsonPath("$.devCode").isString())
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
                        .andExpect(jsonPath("$.tokenType").value("Bearer"))
                        .andExpect(jsonPath("$.accessToken").isString())
                        .andExpect(jsonPath("$.adult.email").value(email))
                        .andExpect(jsonPath("$.adult.displayName").value((Object) null))
                        .andReturn();

        // displayName may be null — Jackson may include or omit; accept either
        String verifyBody = verifyResult.getResponse().getContentAsString();
        String token =
                verifyBody.replaceAll("(?s).*\"accessToken\"\\s*:\\s*\"([^\"]+)\".*", "$1");

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        mockMvc.perform(
                        post("/api/auth/verify-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meWithoutBearerReturns401() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
}
