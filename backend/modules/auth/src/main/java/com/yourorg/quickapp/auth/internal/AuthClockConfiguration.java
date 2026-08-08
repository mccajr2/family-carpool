package com.yourorg.quickapp.auth.internal;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class AuthClockConfiguration {

    @Bean
    Clock authClock() {
        return Clock.systemUTC();
    }
}
