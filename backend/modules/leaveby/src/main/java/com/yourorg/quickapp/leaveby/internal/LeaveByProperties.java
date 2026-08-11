package com.yourorg.quickapp.leaveby.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.leaveby")
public record LeaveByProperties(
        int fixedBufferSeconds,
        int fallbackDurationSeconds,
        double peakMultiplier,
        double offPeakMultiplier,
        int morningPeakStartHourUtc,
        int morningPeakEndHourUtc,
        int eveningPeakStartHourUtc,
        int eveningPeakEndHourUtc) {}
