package com.yourorg.quickapp.auth.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class AuthRateLimiterTest {

    @Test
    void allowsUpToLimitThenRejectsWithinWindow() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-08T00:00:00Z"), ZoneOffset.UTC);
        AuthRateLimiter limiter = new AuthRateLimiter(clock);

        assertThat(limiter.tryConsume("a", 3, 60)).isTrue();
        assertThat(limiter.tryConsume("a", 3, 60)).isTrue();
        assertThat(limiter.tryConsume("a", 3, 60)).isTrue();
        assertThat(limiter.tryConsume("a", 3, 60)).isFalse();
    }

    @Test
    void resetsAfterWindowElapses() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-08T00:00:00Z"));
        AuthRateLimiter limiter = new AuthRateLimiter(clock);

        assertThat(limiter.tryConsume("b", 1, 60)).isTrue();
        assertThat(limiter.tryConsume("b", 1, 60)).isFalse();

        clock.advanceSeconds(60);
        assertThat(limiter.tryConsume("b", 1, 60)).isTrue();
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advanceSeconds(long seconds) {
            instant = instant.plusSeconds(seconds);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return Clock.fixed(instant, zone);
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
