package com.yourorg.quickapp.calendar;

import java.time.Instant;
import java.util.UUID;

public record CalendarConflictResponse(
        CalendarConflictType type,
        UUID kidId,
        UUID adultId,
        String adultDisplayName,
        CalendarItemSource otherSource,
        UUID otherItemId,
        String otherTitle,
        Instant otherStartsAt) {}
