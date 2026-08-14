package com.yourorg.quickapp.family.internal;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic vPIC for tests. Honda Odyssey → 8 seats; Civic → 5; unknown model
 * misses. Makes/models are a small fixed catalog.
 */
@Component
@ConditionalOnProperty(name = "app.vpic.provider", havingValue = "stub", matchIfMissing = false)
public class StubVpicPort implements VpicPort {

    private final AtomicInteger httpCalls = new AtomicInteger();

    public int httpCallCount() {
        return httpCalls.get();
    }

    @Override
    public List<String> listMakes() {
        httpCalls.incrementAndGet();
        return List.of("HONDA", "TOYOTA", "FORD");
    }

    @Override
    public List<String> listModels(String make, int year) {
        httpCalls.incrementAndGet();
        if (make == null || !"HONDA".equalsIgnoreCase(make.trim())) {
            return List.of();
        }
        if (year < 1996) {
            return List.of();
        }
        return List.of("Odyssey", "Civic", "Pilot");
    }

    @Override
    public Optional<Integer> suggestSeats(int year, String make, String model) {
        httpCalls.incrementAndGet();
        if (make == null || model == null) {
            return Optional.empty();
        }
        if (!"HONDA".equalsIgnoreCase(make.trim())) {
            return Optional.empty();
        }
        String key = model.trim().toLowerCase(Locale.ROOT);
        return switch (key) {
            case "odyssey" -> Optional.of(8);
            case "civic" -> Optional.of(5);
            case "pilot" -> Optional.of(8);
            default -> Optional.empty();
        };
    }
}
