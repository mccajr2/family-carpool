package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyGeocodeApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.family.GeoPointDto;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class LeaveByApiImpl implements LeaveByApi {

    static final String REASON_NO_ORIGIN = "NO_ORIGIN";
    static final String REASON_NO_DESTINATION = "NO_DESTINATION";
    static final String REASON_GEOCODE_FAILED = "GEOCODE_FAILED";

    private final FamilyMembershipApi membershipApi;
    private final FamilyPlaceApi placeApi;
    private final FamilyGeocodeApi geocodeApi;
    private final ManualEventCalendarApi manualEventCalendarApi;
    private final FeedCalendarApi feedCalendarApi;
    private final CalendarLeaveFromRepository leaveFromRepository;
    private final RouteCacheRepository routeCacheRepository;
    private final OsrmPort osrmPort;
    private final LeaveByProperties properties;

    LeaveByApiImpl(
            FamilyMembershipApi membershipApi,
            FamilyPlaceApi placeApi,
            FamilyGeocodeApi geocodeApi,
            ManualEventCalendarApi manualEventCalendarApi,
            FeedCalendarApi feedCalendarApi,
            CalendarLeaveFromRepository leaveFromRepository,
            RouteCacheRepository routeCacheRepository,
            OsrmPort osrmPort,
            LeaveByProperties properties) {
        this.membershipApi = membershipApi;
        this.placeApi = placeApi;
        this.geocodeApi = geocodeApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.feedCalendarApi = feedCalendarApi;
        this.leaveFromRepository = leaveFromRepository;
        this.routeCacheRepository = routeCacheRepository;
        this.osrmPort = osrmPort;
        this.properties = properties;
    }

    @Override
    @Transactional
    public LeaveByEnrichmentDto enrich(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Instant startsAt,
            String location) {
        return enrichAll(
                        adultId,
                        List.of(new LeaveByItemInput(source, itemId, startsAt, location)),
                        true)
                .getFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public LeaveByEnrichmentDto enrichCheap(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Instant startsAt,
            String location) {
        return enrichAll(
                        adultId,
                        List.of(new LeaveByItemInput(source, itemId, startsAt, location)),
                        false)
                .getFirst();
    }

    @Override
    @Transactional
    public List<LeaveByEnrichmentDto> enrichMany(UUID adultId, List<LeaveByItemInput> items) {
        return enrichAll(adultId, items, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveByEnrichmentDto> enrichCheapMany(
            UUID adultId, List<LeaveByItemInput> items) {
        return enrichAll(adultId, items, false);
    }

    @Override
    @Transactional
    public void setLeaveFrom(UUID adultId, LeaveByItemSource source, UUID itemId, UUID placeId) {
        CirclePlaceDto place = placeApi.requireLocatedPlaceForMember(adultId, placeId);
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        requireItemInCircle(circleId, source, itemId);

        Instant now = Instant.now();
        Optional<CalendarLeaveFromEntity> existing =
                leaveFromRepository.findByAdultIdAndItemSourceAndItemId(adultId, source, itemId);
        if (existing.isPresent()) {
            existing.get().setPlaceId(place.id(), now);
        } else {
            leaveFromRepository.save(
                    new CalendarLeaveFromEntity(
                            UUID.randomUUID(), adultId, source, itemId, place.id(), now, now));
        }
    }

    private List<LeaveByEnrichmentDto> enrichAll(
            UUID adultId, List<LeaveByItemInput> items, boolean allowHttp) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        Map<String, Optional<GeoPointDto>> destinations = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();
        List<LeaveByEnrichmentDto> out = new ArrayList<>(items.size());
        for (LeaveByItemInput item : items) {
            out.add(enrichOne(adultId, item, allowHttp, destinations, durations));
        }
        return List.copyOf(out);
    }

    private LeaveByEnrichmentDto enrichOne(
            UUID adultId,
            LeaveByItemInput item,
            boolean allowHttp,
            Map<String, Optional<GeoPointDto>> destinations,
            Map<String, Optional<Double>> durations) {
        Optional<CirclePlaceDto> origin =
                resolveOrigin(adultId, item.source(), item.itemId());
        if (origin.isEmpty()) {
            return LeaveByEnrichmentDto.unavailable(null, null, REASON_NO_ORIGIN);
        }
        CirclePlaceDto place = origin.get();
        String location = item.location();
        if (location == null || location.isBlank()) {
            return LeaveByEnrichmentDto.unavailable(
                    place.id(), place.name(), REASON_NO_DESTINATION);
        }
        String locKey = normalizeLocation(location);
        Optional<GeoPointDto> destination =
                destinations.computeIfAbsent(
                        locKey,
                        ignored ->
                                allowHttp
                                        ? geocodeApi.resolveLocation(location)
                                        : geocodeApi.findCachedLocation(location));
        if (destination.isEmpty()) {
            if (!allowHttp) {
                return LeaveByEnrichmentDto.pending(place.id(), place.name());
            }
            return LeaveByEnrichmentDto.unavailable(
                    place.id(), place.name(), REASON_GEOCODE_FAILED);
        }
        GeoPointDto dest = destination.get();
        String routeKey =
                LeaveByRouteKeys.routeKey(
                        place.latitude(), place.longitude(), dest.latitude(), dest.longitude());
        Optional<Double> routed =
                durations.computeIfAbsent(
                        routeKey, ignored -> lookupDuration(routeKey, place, dest, allowHttp));
        if (!allowHttp && routed.isEmpty()) {
            return LeaveByEnrichmentDto.pending(place.id(), place.name());
        }
        double travelSeconds =
                routed.orElse((double) properties.fallbackDurationSeconds());
        double multiplier = LeaveByMath.timeOfDayMultiplier(item.startsAt(), properties);
        Instant leaveByAt =
                LeaveByMath.leaveByAt(
                        item.startsAt(),
                        travelSeconds,
                        multiplier,
                        properties.fixedBufferSeconds());
        return LeaveByEnrichmentDto.ok(place.id(), place.name(), leaveByAt);
    }

    private Optional<Double> lookupDuration(
            String routeKey, CirclePlaceDto origin, GeoPointDto dest, boolean allowHttp) {
        Optional<RouteCacheEntity> cached = routeCacheRepository.findById(routeKey);
        if (cached.isPresent()) {
            return Optional.of(cached.get().durationSeconds());
        }
        if (!allowHttp) {
            return Optional.empty();
        }
        Optional<Double> live =
                osrmPort.drivingDurationSeconds(
                        origin.latitude(),
                        origin.longitude(),
                        dest.latitude(),
                        dest.longitude());
        live.ifPresent(
                seconds ->
                        routeCacheRepository.save(
                                new RouteCacheEntity(routeKey, seconds, Instant.now())));
        return live;
    }

    static String normalizeLocation(String location) {
        return location == null ? "" : location.trim().toLowerCase(Locale.ROOT);
    }

    private Optional<CirclePlaceDto> resolveOrigin(
            UUID adultId, LeaveByItemSource source, UUID itemId) {
        Optional<UUID> overridePlaceId =
                leaveFromRepository
                        .findByAdultIdAndItemSourceAndItemId(adultId, source, itemId)
                        .map(CalendarLeaveFromEntity::placeId);
        if (overridePlaceId.isPresent()) {
            Optional<CirclePlaceDto> override =
                    placeApi.findPlaceForMember(adultId, overridePlaceId.get()).filter(CirclePlaceDto::located);
            if (override.isPresent()) {
                return override;
            }
        }
        Optional<CirclePlaceDto> membershipDefault = placeApi.findDefaultLeaveFromForMember(adultId);
        if (membershipDefault.isPresent()) {
            return membershipDefault;
        }
        List<CirclePlaceDto> located = placeApi.listLocatedPlacesForMember(adultId);
        if (located.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(located.getFirst());
    }

    private void requireItemInCircle(UUID circleId, LeaveByItemSource source, UUID itemId) {
        boolean found =
                switch (source) {
                    case MANUAL -> manualEventCalendarApi.findInCircle(circleId, itemId).isPresent();
                    case FEED -> feedCalendarApi.findEventInCircle(circleId, itemId).isPresent();
                };
        if (!found) {
            throw new FamilyAccessException(HttpStatus.NOT_FOUND, "Calendar item not found");
        }
    }
}
