package com.yourorg.quickapp.leaveby;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Public leave-by surface for calendar enrichment, per-adult leave-from
 * overrides, and multi-stop confirmed-ride itineraries.
 */
public interface LeaveByApi {

    /**
     * Soft-fail enrichment for one calendar row. Never throws for missing
     * coords / geocode / OSRM — returns UNAVAILABLE or OK with fallback. May
     * call Nominatim / OSRM on cache miss; persists successful durations.
     *
     * <p>Origin order for the signed-in adult: active coverage leave-from →
     * item override → membership default → first located place.
     */
    LeaveByEnrichmentDto enrich(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Instant startsAt,
            String location);

    /**
     * Cache-only enrichment: no Nominatim or OSRM HTTP. Returns PENDING when
     * dest, one-time origin, or duration is not already cached.
     */
    LeaveByEnrichmentDto enrichCheap(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Instant startsAt,
            String location);

    /**
     * Full enrich for many rows. Collapses duplicate normalized locations and
     * origin+dest routes to one upstream lookup each.
     */
    List<LeaveByEnrichmentDto> enrichMany(UUID adultId, List<LeaveByItemInput> items);

    /**
     * Cache-only enrich for many rows (calendar list). Same collapse; never
     * HTTP.
     */
    List<LeaveByEnrichmentDto> enrichCheapMany(UUID adultId, List<LeaveByItemInput> items);

    /**
     * Enrich leave-by for an explicit leave-from setting (e.g. a coverage row).
     * Both place id and address null → adult's membership default → first
     * located. {@code allowHttp false} is cache-only (cheap list).
     */
    LeaveByEnrichmentDto enrichForLeaveFrom(
            UUID adultIdForDefault,
            UUID leaveFromPlaceId,
            String leaveFromAddress,
            Instant startsAt,
            String location,
            boolean allowHttp);

    /**
     * Batch {@link #enrichForLeaveFrom} sharing destination/route caches within
     * the batch.
     */
    List<LeaveByEnrichmentDto> enrichForLeaveFromMany(
            List<LeaveFromEnrichmentInput> inputs, boolean allowHttp);

    /**
     * Batch detour minutes for inbound carpool asks. Uses default leave-from
     * origin (no per-event override). Soft-fails to {@code null} per row when
     * origin, geocode, or OSRM is unavailable. Collapses duplicate addresses and
     * routes within the batch.
     */
    List<Integer> detourMinutesMany(UUID adultId, List<DetourItemInput> items);

    /**
     * Build and persist a multi-stop itinerary (resolved leave-from → pickups →
     * destination) for the driving adult. Origin uses the same resolution as
     * Agenda (coverage → item override → default → first located). Soft-fail
     * geocode → UNAVAILABLE. OSRM miss uses config fallback duration and remains
     * OK — fallback is not written to the pairwise duration cache.
     */
    CalendarRouteDto upsertCalendarRoute(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            String eventTitle,
            List<CalendarRoutePickupInput> pickups,
            String destinationName,
            String destinationAddress);

    /**
     * Return the cached itinerary when the stop fingerprint still matches the
     * resolved origin + pickups + destination; otherwise recompute and replace.
     */
    CalendarRouteDto getOrRefreshCalendarRoute(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            String eventTitle,
            List<CalendarRoutePickupInput> pickups,
            String destinationName,
            String destinationAddress);

    /** Drop the cached itinerary for one driving adult + calendar item. */
    void invalidateCalendarRoute(UUID drivingAdultId, LeaveByItemSource source, UUID itemId);

    /** Drop all cached itineraries for a calendar item (any driving adult). */
    void invalidateCalendarRoutesForItem(LeaveByItemSource source, UUID itemId);

    /** Drop every cached itinerary for a driving adult (origin fingerprint may change). */
    void invalidateCalendarRoutesForDrivingAdult(UUID drivingAdultId);

    /**
     * Persist item-level leave-from for this adult. Modes: named located place,
     * one-time address, or both null to clear (Default). Place and address are
     * mutually exclusive.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 404 / 400 as
     *     documented on OpenAPI setCalendarLeaveFrom
     */
    void setLeaveFrom(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            UUID leaveFromPlaceId,
            String leaveFromAddress);
}
