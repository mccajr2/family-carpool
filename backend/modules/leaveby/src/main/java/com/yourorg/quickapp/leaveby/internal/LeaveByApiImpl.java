package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyGeocodeApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.family.GeoPointDto;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.leaveby.CalendarRouteDto;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import com.yourorg.quickapp.leaveby.CalendarRouteStopDto;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.DetourItemInput;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
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
    private final ItineraryRepository itineraryRepository;
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
            ItineraryRepository itineraryRepository,
            OsrmPort osrmPort,
            LeaveByProperties properties) {
        this.membershipApi = membershipApi;
        this.placeApi = placeApi;
        this.geocodeApi = geocodeApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.feedCalendarApi = feedCalendarApi;
        this.leaveFromRepository = leaveFromRepository;
        this.routeCacheRepository = routeCacheRepository;
        this.itineraryRepository = itineraryRepository;
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
    public List<Integer> detourMinutesMany(UUID adultId, List<DetourItemInput> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        Optional<CirclePlaceDto> origin = resolveDefaultOrigin(adultId);
        if (origin.isEmpty()) {
            return nullFilledList(items.size());
        }
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();
        List<Integer> out = new ArrayList<>(items.size());
        for (DetourItemInput item : items) {
            out.add(detourMinutesOne(origin.get(), item, geocoded, durations));
        }
        return Collections.unmodifiableList(out);
    }

    @Override
    @Transactional
    public CalendarRouteDto upsertCalendarRoute(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            String eventTitle,
            List<CalendarRoutePickupInput> pickups,
            String destinationName,
            String destinationAddress) {
        return buildAndPersistCalendarRoute(
                drivingAdultId,
                source,
                itemId,
                eventTitle,
                pickups == null ? List.of() : pickups,
                destinationName,
                destinationAddress);
    }

    @Override
    @Transactional
    public CalendarRouteDto getOrRefreshCalendarRoute(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            String eventTitle,
            List<CalendarRoutePickupInput> pickups,
            String destinationName,
            String destinationAddress) {
        List<CalendarRoutePickupInput> safePickups = pickups == null ? List.of() : pickups;
        Optional<String> fingerprint = currentFingerprint(drivingAdultId, safePickups, destinationAddress);
        if (fingerprint.isPresent()) {
            Optional<ItineraryEntity> cached =
                    itineraryRepository.findByDrivingAdultIdAndItemSourceAndItemId(
                            drivingAdultId, source, itemId);
            if (cached.isPresent()
                    && fingerprint.get().equals(cached.get().stopFingerprint())) {
                return toDto(cached.get());
            }
        }
        return buildAndPersistCalendarRoute(
                drivingAdultId,
                source,
                itemId,
                eventTitle,
                safePickups,
                destinationName,
                destinationAddress);
    }

    @Override
    @Transactional
    public void invalidateCalendarRoute(
            UUID drivingAdultId, LeaveByItemSource source, UUID itemId) {
        itineraryRepository.deleteByDrivingAdultIdAndItemSourceAndItemId(
                drivingAdultId, source, itemId);
    }

    @Override
    @Transactional
    public void invalidateCalendarRoutesForItem(LeaveByItemSource source, UUID itemId) {
        itineraryRepository.deleteByItemSourceAndItemId(source, itemId);
    }

    @Override
    @Transactional
    public void invalidateCalendarRoutesForDrivingAdult(UUID drivingAdultId) {
        itineraryRepository.deleteByDrivingAdultId(drivingAdultId);
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

    private Integer detourMinutesOne(
            CirclePlaceDto origin,
            DetourItemInput item,
            Map<String, Optional<GeoPointDto>> geocoded,
            Map<String, Optional<Double>> durations) {
        String pickupAddress = item.pickupAddress();
        String eventLocation = item.eventLocation();
        if (pickupAddress == null
                || pickupAddress.isBlank()
                || eventLocation == null
                || eventLocation.isBlank()) {
            return null;
        }
        Optional<GeoPointDto> pickup =
                geocoded.computeIfAbsent(
                        normalizeLocation(pickupAddress),
                        ignored -> geocodeApi.resolveLocation(pickupAddress));
        Optional<GeoPointDto> event =
                geocoded.computeIfAbsent(
                        normalizeLocation(eventLocation),
                        ignored -> geocodeApi.resolveLocation(eventLocation));
        if (pickup.isEmpty() || event.isEmpty()) {
            return null;
        }
        Optional<Double> direct = routeDuration(origin, event.get(), durations);
        Optional<Double> originToPickup = routeDuration(origin, pickup.get(), durations);
        Optional<Double> pickupToEvent = routeDuration(pickup.get(), event.get(), durations);
        return DetourMath.detourMinutes(direct, originToPickup, pickupToEvent);
    }

    private Optional<Double> routeDuration(
            CirclePlaceDto origin, GeoPointDto destination, Map<String, Optional<Double>> durations) {
        return routeDuration(
                origin.latitude(),
                origin.longitude(),
                destination.latitude(),
                destination.longitude(),
                durations);
    }

    private Optional<Double> routeDuration(
            GeoPointDto origin, GeoPointDto destination, Map<String, Optional<Double>> durations) {
        return routeDuration(
                origin.latitude(),
                origin.longitude(),
                destination.latitude(),
                destination.longitude(),
                durations);
    }

    private Optional<Double> routeDuration(
            double fromLat,
            double fromLng,
            double toLat,
            double toLng,
            Map<String, Optional<Double>> durations) {
        String routeKey = LeaveByRouteKeys.routeKey(fromLat, fromLng, toLat, toLng);
        return durations.computeIfAbsent(
                routeKey, ignored -> lookupRoutedDuration(routeKey, fromLat, fromLng, toLat, toLng));
    }

    private Optional<Double> lookupRoutedDuration(
            String routeKey, double fromLat, double fromLng, double toLat, double toLng) {
        Optional<RouteCacheEntity> cached = routeCacheRepository.findById(routeKey);
        if (cached.isPresent()) {
            return Optional.of(cached.get().durationSeconds());
        }
        Optional<Double> live = osrmPort.drivingDurationSeconds(fromLat, fromLng, toLat, toLng);
        live.ifPresent(
                seconds ->
                        routeCacheRepository.save(
                                new RouteCacheEntity(routeKey, seconds, Instant.now())));
        return live;
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
        return resolveDefaultOrigin(adultId);
    }

    private Optional<CirclePlaceDto> resolveDefaultOrigin(UUID adultId) {
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

    private static List<Integer> nullFilledList(int size) {
        List<Integer> out = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            out.add(null);
        }
        return Collections.unmodifiableList(out);
    }

    private CalendarRouteDto buildAndPersistCalendarRoute(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            String eventTitle,
            List<CalendarRoutePickupInput> pickups,
            String destinationName,
            String destinationAddress) {
        int bufferMinutes = RouteBufferMinutes.forTitle(eventTitle);
        Optional<CirclePlaceDto> homeOpt = resolveDefaultOrigin(drivingAdultId);
        if (homeOpt.isEmpty()) {
            return persistRoute(
                    drivingAdultId,
                    source,
                    itemId,
                    "",
                    CalendarRouteDto.unavailable(REASON_NO_ORIGIN, bufferMinutes, List.of()));
        }
        CirclePlaceDto home = homeOpt.get();
        if (destinationAddress == null || destinationAddress.isBlank()) {
            CalendarRouteStopDto homeStop =
                    new CalendarRouteStopDto(
                            home.name(),
                            home.address() == null ? "" : home.address(),
                            CalendarRouteStopKind.HOME,
                            null);
            String fingerprint =
                    ItineraryFingerprint.compute(
                            home.id(),
                            home.latitude(),
                            home.longitude(),
                            home.address(),
                            pickupAddresses(pickups),
                            destinationAddress);
            return persistRoute(
                    drivingAdultId,
                    source,
                    itemId,
                    fingerprint,
                    CalendarRouteDto.unavailable(
                            REASON_NO_DESTINATION, bufferMinutes, List.of(homeStop)));
        }

        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();

        List<CalendarRouteStopDto> stops = new ArrayList<>();
        List<GeoPointDto> points = new ArrayList<>();
        stops.add(
                new CalendarRouteStopDto(
                        home.name(),
                        home.address() == null ? "" : home.address(),
                        CalendarRouteStopKind.HOME,
                        null));
        points.add(new GeoPointDto(home.latitude(), home.longitude()));

        for (CalendarRoutePickupInput pickup : pickups) {
            if (pickup == null || pickup.address() == null || pickup.address().isBlank()) {
                continue;
            }
            Optional<GeoPointDto> point =
                    geocoded.computeIfAbsent(
                            normalizeLocation(pickup.address()),
                            ignored -> geocodeApi.resolveLocation(pickup.address()));
            if (point.isEmpty()) {
                String fingerprint =
                        ItineraryFingerprint.compute(
                                home.id(),
                                home.latitude(),
                                home.longitude(),
                                home.address(),
                                pickupAddresses(pickups),
                                destinationAddress);
                return persistRoute(
                        drivingAdultId,
                        source,
                        itemId,
                        fingerprint,
                        CalendarRouteDto.unavailable(
                                REASON_GEOCODE_FAILED, bufferMinutes, List.copyOf(stops)));
            }
            String name =
                    pickup.name() == null || pickup.name().isBlank()
                            ? pickup.address()
                            : pickup.name();
            CalendarRouteNotifyContact contact = pickup.contact();
            stops.add(
                    new CalendarRouteStopDto(
                            name, pickup.address(), CalendarRouteStopKind.PICKUP, contact));
            points.add(point.get());
        }

        Optional<GeoPointDto> destination =
                geocoded.computeIfAbsent(
                        normalizeLocation(destinationAddress),
                        ignored -> geocodeApi.resolveLocation(destinationAddress));
        if (destination.isEmpty()) {
            String fingerprint =
                    ItineraryFingerprint.compute(
                            home.id(),
                            home.latitude(),
                            home.longitude(),
                            home.address(),
                            pickupAddresses(pickups),
                            destinationAddress);
            return persistRoute(
                    drivingAdultId,
                    source,
                    itemId,
                    fingerprint,
                    CalendarRouteDto.unavailable(
                            REASON_GEOCODE_FAILED, bufferMinutes, List.copyOf(stops)));
        }
        String destName =
                destinationName == null || destinationName.isBlank()
                        ? destinationAddress
                        : destinationName;
        stops.add(
                new CalendarRouteStopDto(
                        destName,
                        destinationAddress,
                        CalendarRouteStopKind.DESTINATION,
                        null));
        points.add(destination.get());

        List<Integer> legMinutes = new ArrayList<>(points.size() - 1);
        for (int i = 0; i < points.size() - 1; i++) {
            GeoPointDto from = points.get(i);
            GeoPointDto to = points.get(i + 1);
            Optional<Double> routed =
                    routeDuration(
                            from.latitude(),
                            from.longitude(),
                            to.latitude(),
                            to.longitude(),
                            durations);
            // Same policy as single-origin leave-by: OSRM soft-fail uses config
            // fallback and stays OK; fallback is not written to leaveby_route_cache.
            double seconds = routed.orElse((double) properties.fallbackDurationSeconds());
            legMinutes.add(minutesFromSeconds(seconds));
        }

        String fingerprint =
                ItineraryFingerprint.compute(
                        home.id(),
                        home.latitude(),
                        home.longitude(),
                        home.address(),
                        pickupAddresses(pickups),
                        destinationAddress);
        return persistRoute(
                drivingAdultId,
                source,
                itemId,
                fingerprint,
                CalendarRouteDto.ok(bufferMinutes, stops, legMinutes));
    }

    private Optional<String> currentFingerprint(
            UUID drivingAdultId,
            List<CalendarRoutePickupInput> pickups,
            String destinationAddress) {
        Optional<CirclePlaceDto> homeOpt = resolveDefaultOrigin(drivingAdultId);
        if (homeOpt.isEmpty()) {
            return Optional.empty();
        }
        CirclePlaceDto home = homeOpt.get();
        return Optional.of(
                ItineraryFingerprint.compute(
                        home.id(),
                        home.latitude(),
                        home.longitude(),
                        home.address(),
                        pickupAddresses(pickups),
                        destinationAddress));
    }

    private CalendarRouteDto persistRoute(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            String fingerprint,
            CalendarRouteDto route) {
        Instant now = Instant.now();
        String stopsJson = ItineraryJson.writeStops(route.stops());
        String legMinutesJson = ItineraryJson.writeLegMinutes(route.legMinutes());
        Optional<ItineraryEntity> existing =
                itineraryRepository.findByDrivingAdultIdAndItemSourceAndItemId(
                        drivingAdultId, source, itemId);
        if (existing.isPresent()) {
            existing
                    .get()
                    .replace(
                            route.status(),
                            route.reason(),
                            route.bufferMinutes(),
                            fingerprint,
                            stopsJson,
                            legMinutesJson,
                            now);
        } else {
            itineraryRepository.save(
                    new ItineraryEntity(
                            UUID.randomUUID(),
                            drivingAdultId,
                            source,
                            itemId,
                            route.status(),
                            route.reason(),
                            route.bufferMinutes(),
                            fingerprint,
                            stopsJson,
                            legMinutesJson,
                            now,
                            now));
        }
        return route;
    }

    private static CalendarRouteDto toDto(ItineraryEntity entity) {
        List<CalendarRouteStopDto> stops = ItineraryJson.readStops(entity.stopsJson());
        List<Integer> legMinutes = ItineraryJson.readLegMinutes(entity.legMinutesJson());
        if (entity.status() == CalendarRouteStatus.OK) {
            return CalendarRouteDto.ok(entity.bufferMinutes(), stops, legMinutes);
        }
        return CalendarRouteDto.unavailable(entity.reason(), entity.bufferMinutes(), stops);
    }

    private static List<String> pickupAddresses(List<CalendarRoutePickupInput> pickups) {
        List<String> addresses = new ArrayList<>();
        for (CalendarRoutePickupInput pickup : pickups) {
            if (pickup != null && pickup.address() != null && !pickup.address().isBlank()) {
                addresses.add(pickup.address());
            }
        }
        return addresses;
    }

    static int minutesFromSeconds(double seconds) {
        return Math.max(0, (int) Math.round(seconds / 60.0));
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
