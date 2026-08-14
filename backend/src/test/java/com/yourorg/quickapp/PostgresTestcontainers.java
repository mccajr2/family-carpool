package com.yourorg.quickapp;

import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Shared Postgres Testcontainers lifecycle for backend SpringBootTests.
 */
public final class PostgresTestcontainers {

    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
                    .withDatabaseName("family_carpool_test")
                    .withUsername("test")
                    .withPassword("test");

    static {
        // Allow tests to run when Docker is available; fail clearly otherwise.
        POSTGRES.start();
    }

    private PostgresTestcontainers() {}

    public static void registerDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        // Many @SpringBootTest contexts share one container; keep pools tiny so
        // we stay under Postgres' default max_connections (~100).
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> "3");
        registry.add("spring.datasource.hikari.minimum-idle", () -> "0");
        registry.add("app.auth.dev-code-echo", () -> "true");
        registry.add("app.auth.code-pepper", () -> "test-pepper");
        // Never hit live Nominatim from CI / local SpringBootTests.
        registry.add("app.geocode.provider", () -> "stub");
        // Never hit live iCal hosts from CI / local SpringBootTests.
        registry.add("app.feeds.fetch-provider", () -> "stub");
        // Do not run the background feed poller in SpringBootTests.
        registry.add("app.feeds.poll-enabled", () -> "false");
        // Never hit live OSRM from CI / local SpringBootTests.
        registry.add("app.leaveby.osrm.provider", () -> "stub");
        // Never hit live NHTSA vPIC from CI / local SpringBootTests.
        registry.add("app.vpic.provider", () -> "stub");
    }

    public static boolean dockerAvailable() {
        return Files.exists(Path.of("/var/run/docker.sock"))
                || Files.exists(Path.of("/Users/jasonmccarthy/.docker/run/docker.sock"));
    }
}
