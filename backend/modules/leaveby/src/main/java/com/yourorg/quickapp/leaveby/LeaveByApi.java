package com.yourorg.quickapp.leaveby;

import java.time.Instant;
import java.util.UUID;

/**
 * Public leave-by surface for calendar enrichment and per-adult leave-from
 * overrides.
 */
public interface LeaveByApi {

    /**
     * Soft-fail enrichment for one calendar row. Never throws for missing
     * coords / geocode / OSRM — returns UNAVAILABLE or OK with fallback.
     */
    LeaveByEnrichmentDto enrich(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Instant startsAt,
            String location);

    /**
     * Persist leave-from for this adult + calendar item.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 404 / 400 as
     *     documented on OpenAPI setCalendarLeaveFrom
     */
    void setLeaveFrom(UUID adultId, LeaveByItemSource source, UUID itemId, UUID placeId);
}
