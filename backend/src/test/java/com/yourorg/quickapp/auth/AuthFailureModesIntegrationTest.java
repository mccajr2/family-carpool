package com.yourorg.quickapp.auth;

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

@SpringBootTest
@AutoConfigureMockMvc
class AuthFailureModesIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
        registry.add("app.auth.request-code-limit", () -> "2");
        registry.add("app.auth.request-code-window-seconds", () -> "900");
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void invalidCodeReturns401() throws Exception {
        mockMvc.perform(
                        post("/api/auth/verify-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"email\":\"nobody@example.com\",\"code\":\"000000\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid or expired code"));
    }

    @Test
    void malformedEmailReturns400() throws Exception {
        mockMvc.perform(
                        post("/api/auth/request-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"email\":\"not-an-email\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void requestCodeRateLimitReturns429() throws Exception {
        String email = "ratelimit-" + System.nanoTime() + "@example.com";
        String body = "{\"email\":\"" + email + "\"}";

        mockMvc.perform(
                        post("/api/auth/request-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isAccepted());
        mockMvc.perform(
                        post("/api/auth/request-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isAccepted());
        mockMvc.perform(
                        post("/api/auth/request-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many code requests"));
    }

    @Test
    void requestCodeSameShapeForUnknownEmail() throws Exception {
        mockMvc.perform(
                        post("/api/auth/request-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"email\":\"brand-new-" + System.nanoTime() + "@ex.com\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.email").isString())
                .andExpect(jsonPath("$.expiresInSeconds").isNumber());
    }
}
