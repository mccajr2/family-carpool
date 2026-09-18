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
     * geocode → UNAVAILABLE. With 2+ geocoded pickups, middle-stop order is
     * auto-optimized by pairwise duration (missing any required duration →
     * UNAVAILABLE / {@code OSRM_UNAVAILABLE}). With 0–1 pickup, OSRM miss uses
     * config fallback duration and remains OK — fallback is not written to the
     * pairwise duration cache.
     *
     * <p>Persists under the TO singleton member-set key for {@code source}+{@code itemId}.
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
     * Build / refresh a multi-stop itinerary for a driving-block member set on
     * one leg. TO: home → middle pickups → venue. FROM: venue → middle dropoffs
     * → home. Cache key is {@code (drivingAdultId, leg, ordered members)}.
     * Multi-member sets fix HOME at the driver's membership default leave-from;
     * per-event coverage leave-froms are caller-supplied middles. Singletons
     * still resolve HOME from the path item's leave-from override chain.
     */
    CalendarRouteDto upsertCalendarRoute(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
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

    /**
     * Member-set + leg variant of {@link #getOrRefreshCalendarRoute(UUID,
     * LeaveByItemSource, UUID, String, List, String, String)}.
     */
    CalendarRouteDto getOrRefreshCalendarRoute(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
            String destinationName,
            String destinationAddress);

    /**
     * Persist a manual middle-stop order for an existing itinerary without
     * changing the stop fingerprint. {@code middleStopIds} must be a
     * permutation of the current middle-stop identities (stop addresses as
     * returned on the route). Recomputes {@code legMinutes} for the new
     * sequence. Unknown / mismatched ids → 400; missing itinerary → 404.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 400 / 404 as
     *     documented above
     */
    CalendarRouteDto reorderCalendarRouteMiddles(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            List<String> middleStopIds);

    /**
     * Reorder middles for a member-set itinerary on the given leg.
     */
    CalendarRouteDto reorderCalendarRouteMiddles(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            List<String> middleStopIds);

    /** Drop the cached itinerary for one driving adult + calendar item (any leg). */
    void invalidateCalendarRoute(UUID drivingAdultId, LeaveByItemSource source, UUID itemId);

    /** Drop all cached itineraries for a calendar item (any driving adult / leg). */
    void invalidateCalendarRoutesForItem(LeaveByItemSource source, UUID itemId);

    /** Drop every cached itinerary for a driving adult (origin fingerprint may change). */
    void invalidateCalendarRoutesForDrivingAdult(UUID drivingAdultId);

    /**
     * Arrival lead buffer from the title heuristic used by Route
     * ({@code practice} 20 / game-like 45 / other 0). Shared with driving-block
     * merge padding — do not re-hardcode those minutes in callers.
     */
    int arrivalBufferMinutes(String title);

    /**
     * Cache-only venue identity + one-way drive seconds for driving-block merge.
     * Same origin/dest resolution as {@link #enrichCheapMany}; never HTTP.
     * Result list matches {@code items} order.
     */
    List<LeaveByVenueDriveDto> cheapVenueDrives(UUID adultId, List<LeaveByItemInput> items);

    /**
     * Persist a per-leg itinerary home-side override (Leaving from / Returning
     * to) and rebuild the route. Modes: named located place, one-time address,
     * or both null to clear (Default). Does <strong>not</strong> write calendar
     * item or coverage leave-from. Changing the override busts the stop
     * fingerprint via the new HOME identity.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 400 when place
     *     and address are both set or address is blank / too long; 404 when the
     *     named place is missing for the member
     */
    CalendarRouteDto setCalendarRouteOrigin(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
            String destinationName,
            String destinationAddress,
            UUID homePlaceId,
            String homeAddress);

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

    /**
     * Pickup-side leave-from for combined-block Route middles: coverage
     * leave-from when explicitly set, else per-item leave-from override.
     * Does <strong>not</strong> fall back to membership default (that is the
     * itinerary HOME start). Empty when neither override is set.
     */
    java.util.Optional<LeaveFromPlaceDto> pickupLeaveFromForRouteMiddle(
            UUID adultId, LeaveByItemSource source, UUID itemId);
}
