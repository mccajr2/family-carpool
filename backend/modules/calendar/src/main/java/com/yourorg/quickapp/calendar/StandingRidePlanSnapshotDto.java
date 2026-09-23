package com.yourorg.quickapp.calendar;

import java.util.List;
import java.util.UUID;

/** Circle-local ride plan group on a locked member item. */
public record StandingRidePlanSnapshotDto(
        List<UUID> kidIds, List<StandingRidePlanLegSnapshotDto> legs) {}
