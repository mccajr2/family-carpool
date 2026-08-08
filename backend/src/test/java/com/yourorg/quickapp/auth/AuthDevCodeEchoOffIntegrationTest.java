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
class AuthDevCodeEchoOffIntegrationTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
        registry.add("app.auth.dev-code-echo", () -> "false");
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void requestCodeOmitsDevCodeWhenEchoDisabled() throws Exception {
        mockMvc.perform(
                        post("/api/auth/request-code")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"email\":\"no-echo@example.com\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.devCode").doesNotExist());
    }
}
