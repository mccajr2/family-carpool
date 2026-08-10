package com.yourorg.quickapp.family;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.PostgresTestcontainers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Regression: default Nominatim provider must start without a RestClient.Builder
 * bean (Boot does not always expose one to Modulith modules).
 */
@SpringBootTest
class NominatimGeocoderContextTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
        // Override the stub forced by PostgresTestcontainers for CI.
        registry.add("app.geocode.provider", () -> "nominatim");
        registry.add("app.geocode.min-interval-ms", () -> "0");
        registry.add(
                "app.geocode.nominatim-base-url", () -> "http://127.0.0.1:9"); // closed port; unused
    }

    @Autowired
    private ApplicationContext context;

    @Test
    void applicationContextLoadsWithNominatimProvider() {
        assertThat(context.getBeanDefinitionNames())
                .anyMatch(name -> name.toLowerCase().contains("nominatim"));
    }
}
