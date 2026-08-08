package com.yourorg.quickapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * Guards the auth OpenAPI contract for adult-auth-magic-link. Fails if greeting
 * returns or required auth paths / Bearer scheme are removed.
 */
class OpenApiContractTest {

    @Test
    void authContractReplacesGreetingAndDocumentsBearerSessions() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).doesNotContain("/api/greeting");
        assertThat(yaml).doesNotContain("GreetingResponse");

        assertThat(yaml).contains("/api/auth/request-code");
        assertThat(yaml).contains("/api/auth/verify-code");
        assertThat(yaml).contains("/api/auth/me");
        assertThat(yaml).contains("/api/auth/logout");

        assertThat(yaml).contains("operationId: requestAuthCode");
        assertThat(yaml).contains("operationId: verifyAuthCode");
        assertThat(yaml).contains("operationId: getCurrentAdult");
        assertThat(yaml).contains("operationId: logout");

        assertThat(yaml).contains("bearerAuth:");
        assertThat(yaml).contains("scheme: bearer");
        assertThat(yaml).contains("AuthSessionResponse:");
        assertThat(yaml).contains("Adult:");
        assertThat(yaml).contains("devCode:");
    }

    private static Path resolveOpenApi() {
        Path fromBackend = Path.of("..", "contracts", "openapi.yaml").normalize().toAbsolutePath();
        if (Files.exists(fromBackend)) {
            return fromBackend;
        }
        return Path.of("contracts", "openapi.yaml").toAbsolutePath();
    }
}
