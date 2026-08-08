package com.yourorg.quickapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {
    @Test
    void verifyModularStructure() {
        ApplicationModules modules = ApplicationModules.of(QuickappApplication.class);
        modules.verify();
        modules.forEach(System.out::println);

        var names =
                modules.stream().map(module -> module.getName()).collect(Collectors.toSet());
        assertThat(names).contains("auth").doesNotContain("greeting");
    }
}
