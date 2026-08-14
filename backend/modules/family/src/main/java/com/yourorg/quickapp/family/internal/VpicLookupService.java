package com.yourorg.quickapp.family.internal;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
class VpicLookupService {

    private final VpicPort vpicPort;
    private final VpicSeatCacheRepository cache;

    VpicLookupService(VpicPort vpicPort, VpicSeatCacheRepository cache) {
        this.vpicPort = vpicPort;
        this.cache = cache;
    }

    List<String> listMakes() {
        return vpicPort.listMakes();
    }

    List<String> listModels(String make, int year) {
        return vpicPort.listModels(make, year);
    }

    Optional<Integer> suggestSeats(int year, String make, String model) {
        String makeKey = normalize(make);
        String modelKey = normalize(model);
        if (makeKey.isEmpty() || modelKey.isEmpty()) {
            return Optional.empty();
        }
        VpicSeatCacheEntity.Key key = new VpicSeatCacheEntity.Key(makeKey, modelKey, year);
        Optional<VpicSeatCacheEntity> cached = cache.findById(key);
        if (cached.isPresent()) {
            return Optional.of(cached.get().seats());
        }
        Optional<Integer> hinted = vpicPort.suggestSeats(year, make, model);
        hinted.ifPresent(
                seats ->
                        cache.save(
                                new VpicSeatCacheEntity(makeKey, modelKey, year, seats, Instant.now())));
        return hinted;
    }

    static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }
}
