package com.yourorg.quickapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CiWorkflowContractTest {

    @Test
    void backendWorkflowPathFiltersIncludeContracts() throws IOException {
        Path workflow = resolveBackendWorkflow();
        assertThat(workflow).exists();
        String yaml = Files.readString(workflow);

        // push + pull_request each list contracts/** so contracts-only PRs run OpenAPI checks.
        assertThat(yaml.split("contracts/\\*\\*", -1)).hasSize(3);
    }

    @Test
    void secretsWorkflowIsNotPathFilteredAndRunsGitleaks() throws IOException {
        Path workflow = resolveSecretsWorkflow();
        assertThat(workflow).exists();
        String yaml = Files.readString(workflow);

        assertThat(yaml).contains("gitleaks/gitleaks-action@v3.0.0");
        assertThat(yaml).contains("pull_request:");
        assertThat(yaml).contains("push:");
        // Required so gitleaks-action can GET /pulls/{n}/commits under read-only tokens.
        assertThat(yaml).contains("pull-requests: read");
        // Secrets can land in any path — no path filters under on:.
        String onBlock = yaml.split("jobs:", 2)[0];
        assertThat(onBlock).doesNotContain("paths:");
        assertThat(yaml).doesNotContain("@main");
        assertThat(yaml).doesNotContain("@master");
    }

    @Test
    void pathFilteredWorkflowsUseCheckoutV7AndWebUsesSetupNodeV7() throws IOException {
        String backend = Files.readString(resolveBackendWorkflow());
        String mobile = Files.readString(resolveWorkflow("mobile.yml"));
        String web = Files.readString(resolveWorkflow("web.yml"));

        assertThat(backend).contains("actions/checkout@v7");
        assertThat(mobile).contains("actions/checkout@v7");
        assertThat(web).contains("actions/checkout@v7");
        assertThat(web).contains("actions/setup-node@v7");
        assertThat(backend).doesNotContain("actions/checkout@v4");
        assertThat(mobile).doesNotContain("actions/checkout@v4");
        assertThat(web).doesNotContain("actions/checkout@v4");
        assertThat(web).doesNotContain("actions/setup-node@v4");
    }

    @Test
    void webToolchainPinsSatisfyJsdom30NodeFloor() throws IOException {
        Path nvmrc = resolveRepoFile("web", ".nvmrc");
        Path packageJson = resolveRepoFile("web", "package.json");
        assertThat(nvmrc).exists();
        assertThat(packageJson).exists();

        String pin = Files.readString(nvmrc).trim();
        assertThat(pin).isEqualTo("24.19.0");

        String pkg = Files.readString(packageJson);
        // jsdom 30 rejects Node 20 and Node 24 below 24.15 — keep engines aligned.
        assertThat(pkg).contains("\"node\": \"^22.22.2 || ^24.15.0 || >=26.0.0\"");
        assertThat(pkg).contains("\"jsdom\": \"^30.0.1\"");
        assertThat(pkg).contains("\"@testing-library/jest-dom\": \"^7.0.0\"");
        assertThat(pkg).contains("\"@testing-library/dom\": \"^10.4.1\"");
        assertThat(pkg).doesNotContain("\"node\": \">=20\"");
    }

    private static Path resolveBackendWorkflow() {
        return resolveWorkflow("backend.yml");
    }

    private static Path resolveSecretsWorkflow() {
        return resolveWorkflow("secrets.yml");
    }

    private static Path resolveWorkflow(String filename) {
        return resolveRepoFile(".github", "workflows", filename);
    }

    private static Path resolveRepoFile(String first, String... more) {
        Path fromBackend = Path.of("..", first);
        for (String part : more) {
            fromBackend = fromBackend.resolve(part);
        }
        fromBackend = fromBackend.normalize().toAbsolutePath();
        if (Files.exists(fromBackend)) {
            return fromBackend;
        }
        Path fromRoot = Path.of(first);
        for (String part : more) {
            fromRoot = fromRoot.resolve(part);
        }
        return fromRoot.toAbsolutePath();
    }
}
