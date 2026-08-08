package com.yourorg.quickapp.auth.internal;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
class AuthRateLimiter {

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    AuthRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** @return true if the call is allowed */
    boolean tryConsume(String key, int limit, int windowSeconds) {
        Instant now = clock.instant();
        while (true) {
            Window current = windows.get(key);
            if (current == null || !current.windowStart().plusSeconds(windowSeconds).isAfter(now)) {
                Window fresh = new Window(now, 1);
                if (current == null) {
                    if (windows.putIfAbsent(key, fresh) == null) {
                        return true;
                    }
                } else if (windows.replace(key, current, fresh)) {
                    return true;
                }
                continue;
            }
            if (current.count() >= limit) {
                return false;
            }
            Window next = new Window(current.windowStart(), current.count() + 1);
            if (windows.replace(key, current, next)) {
                return true;
            }
        }
    }

    private record Window(Instant windowStart, int count) {}
}
