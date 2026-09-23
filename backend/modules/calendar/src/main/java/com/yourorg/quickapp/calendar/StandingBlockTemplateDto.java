package com.yourorg.quickapp.calendar;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Persisted circle standing drive-block plan (Lock template). */
public record StandingBlockTemplateDto(
        UUID id,
        UUID circleId,
        UUID createdByAdultId,
        String timeZone,
        Instant createdAt,
        List<StandingBlockMemberSnapshotDto> members) {}
