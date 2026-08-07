package com.yourorg.quickapp;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {
    @Test
    void verifyModularStructure() {
        ApplicationModules modules = ApplicationModules.of(QuickappApplication.class);
        modules.verify();
        modules.forEach(System.out::println);
    }
}