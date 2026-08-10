package com.yourorg.quickapp;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {
    @Test
    void verifyModularStructure() {
        ApplicationModules modules = ApplicationModules.of(QuickappApplication.class);
        modules.verify();
        modules.forEach(System.out::println);

        assertThat(modules.getModuleByName("auth")).isPresent();
        assertThat(modules.getModuleByName("family")).isPresent();
        assertThat(modules.getModuleByName("feeds")).isPresent();
        assertThat(modules.getModuleByName("events")).isPresent();
        assertThat(modules.getModuleByName("calendar")).isPresent();
        assertThat(modules.getModuleByName("greeting")).isEmpty();
    }
}
