package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
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
import com.yourorg.quickapp.leaveby.LeaveFromEnrichmentInput;
import com.yourorg.quickapp.leaveby.DetourItemInput;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class LeaveByApiImpl implements LeaveByApi {

    static final String REASON_NO_ORIGIN = "NO_ORIGIN";
    static final String REASON_NO_DESTINATION = "NO_DESTINATION";
    static final String REASON_GEOCODE_FAILED = "GEOCODE_FAILED";

    private static final Set<CoverageStatus> ACTIVE_COVERAGE =
            Set.of(CoverageStatus.PENDING, CoverageStatus.CONFIRMED);
    private static final int LEAVE_FROM_ADDRESS_MAX = 255;

    private final FamilyMembershipApi membershipApi;
    private final FamilyPlaceApi placeApi;
    private final FamilyGeocodeApi geocodeApi;
    private final CoverageApi coverageApi;
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
            CoverageApi coverageApi,
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
        this.coverageApi = coverageApi;
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
    public LeaveByEnrichmentDto enrichForLeaveFrom(
            UUID adultIdForDefault,
            UUID leaveFromPlaceId,
            String leaveFromAddress,
            Instant startsAt,
            String location,
            boolean allowHttp) {
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();
        return enrichWithOverride(
                adultIdForDefault,
                leaveFromPlaceId,
                leaveFromAddress,
                startsAt,
                location,
                allowHttp,
                geocoded,
                durations);
    }

    @Override
    @Transactional
    public List<LeaveByEnrichmentDto> enrichForLeaveFromMany(
            List<LeaveFromEnrichmentInput> inputs, boolean allowHttp) {
        if (inputs == null || inputs.isEmpty()) {
            return List.of();
        }
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();
        List<LeaveByEnrichmentDto> out = new ArrayList<>(inputs.size());
        for (LeaveFromEnrichmentInput input : inputs) {
            out.add(
                    enrichWithOverride(
                            input.adultIdForDefault(),
                            input.leaveFromPlaceId(),
                            input.leaveFromAddress(),
                            input.startsAt(),
                            input.location(),
                            allowHttp,
                            geocoded,
                            durations));
        }
        return List.copyOf(out);
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
        Optional<String> fingerprint =
                currentFingerprint(drivingAdultId, source, itemId, safePickups, destinationAddress);
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
    public void setLeaveFrom(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            UUID leaveFromPlaceId,
            String leaveFromAddress) {
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        requireItemInCircle(circleId, source, itemId);

        String trimmedAddress = leaveFromAddress == null ? null : leaveFromAddress.trim();
        if (trimmedAddress != null && trimmedAddress.isEmpty()) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "leaveFromAddress must be non-empty when set");
        }
        if (leaveFromPlaceId != null && trimmedAddress != null) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST,
                    "leaveFromPlaceId and leaveFromAddress are mutually exclusive");
        }
        if (trimmedAddress != null && trimmedAddress.length() > LEAVE_FROM_ADDRESS_MAX) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST,
                    "leaveFromAddress must be at most " + LEAVE_FROM_ADDRESS_MAX + " characters");
        }

        Instant now = Instant.now();
        Optional<CalendarLeaveFromEntity> existing =
                leaveFromRepository.findByAdultIdAndItemSourceAndItemId(adultId, source, itemId);

        if (leaveFromPlaceId == null && trimmedAddress == null) {
            existing.ifPresent(leaveFromRepository::delete);
            return;
        }

        UUID placeId = null;
        String address = null;
        if (leaveFromPlaceId != null) {
            placeApi.requireLocatedPlaceForMember(adultId, leaveFromPlaceId);
            placeId = leaveFromPlaceId;
        } else {
            address = trimmedAddress;
        }

        if (existing.isPresent()) {
            existing.get().setOverride(placeId, address, now);
        } else {
            leaveFromRepository.save(
                    new CalendarLeaveFromEntity(
                            UUID.randomUUID(),
                            adultId,
                            source,
                            itemId,
                            placeId,
                            address,
                            now,
                            now));
        }
    }

    private List<LeaveByEnrichmentDto> enrichAll(
            UUID adultId, List<LeaveByItemInput> items, boolean allowHttp) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();
        List<LeaveByEnrichmentDto> out = new ArrayList<>(items.size());
        for (LeaveByItemInput item : items) {
            LeaveFromOverride override = leaveFromForAdult(adultId, item.source(), item.itemId());
            out.add(
                    enrichWithOverride(
                            adultId,
                            override.placeId(),
                            override.address(),
                            item.startsAt(),
                            item.location(),
                            allowHttp,
                            geocoded,
                            durations));
        }
        return List.copyOf(out);
    }

    private LeaveByEnrichmentDto enrichWithOverride(
            UUID adultIdForDefault,
            UUID leaveFromPlaceId,
            String leaveFromAddress,
            Instant startsAt,
            String location,
            boolean allowHttp,
            Map<String, Optional<GeoPointDto>> geocoded,
            Map<String, Optional<Double>> durations) {
        Optional<ResolvedOrigin> originOpt =
                resolveOriginFields(
                        adultIdForDefault, leaveFromPlaceId, leaveFromAddress, allowHttp, geocoded);
        if (originOpt.isEmpty()) {
            return LeaveByEnrichmentDto.unavailable(null, null, REASON_NO_ORIGIN);
        }
        ResolvedOrigin origin = originOpt.get();
        if (!origin.located()) {
            if (!allowHttp) {
                return LeaveByEnrichmentDto.pending(
                        origin.placeId(), origin.placeName(), origin.oneTimeAddress());
            }
            return LeaveByEnrichmentDto.unavailable(
                    origin.placeId(),
                    origin.placeName(),
                    origin.oneTimeAddress(),
                    REASON_GEOCODE_FAILED);
        }
        if (location == null || location.isBlank()) {
            return LeaveByEnrichmentDto.unavailable(
                    origin.placeId(),
                    origin.placeName(),
                    origin.oneTimeAddress(),
                    REASON_NO_DESTINATION);
        }
        String locKey = normalizeLocation(location);
        Optional<GeoPointDto> destination =
                geocoded.computeIfAbsent(
                        locKey,
                        ignored ->
                                allowHttp
                                        ? geocodeApi.resolveLocation(location)
                                        : geocodeApi.findCachedLocation(location));
        if (destination.isEmpty()) {
            if (!allowHttp) {
                return LeaveByEnrichmentDto.pending(
                        origin.placeId(), origin.placeName(), origin.oneTimeAddress());
            }
            return LeaveByEnrichmentDto.unavailable(
                    origin.placeId(),
                    origin.placeName(),
                    origin.oneTimeAddress(),
                    REASON_GEOCODE_FAILED);
        }
        GeoPointDto dest = destination.get();
        String routeKey =
                LeaveByRouteKeys.routeKey(
                        origin.latitude(), origin.longitude(), dest.latitude(), dest.longitude());
        Optional<Double> routed =
                durations.computeIfAbsent(
                        routeKey,
                        ignored ->
                                lookupDuration(
                                        routeKey,
                                        origin.latitude(),
                                        origin.longitude(),
                                        dest.latitude(),
                                        dest.longitude(),
                                        allowHttp));
        if (!allowHttp && routed.isEmpty()) {
            return LeaveByEnrichmentDto.pending(
                    origin.placeId(), origin.placeName(), origin.oneTimeAddress());
        }
        double travelSeconds = routed.orElse((double) properties.fallbackDurationSeconds());
        double multiplier = LeaveByMath.timeOfDayMultiplier(startsAt, properties);
        Instant leaveByAt =
                LeaveByMath.leaveByAt(
                        startsAt, travelSeconds, multiplier, properties.fixedBufferSeconds());
        return LeaveByEnrichmentDto.ok(
                origin.placeId(), origin.placeName(), origin.oneTimeAddress(), leaveByAt);
    }

    private LeaveFromOverride leaveFromForAdult(
            UUID adultId, LeaveByItemSource source, UUID itemId) {
        Optional<CoverageAssignmentDto> coverage = activeCoverageForAdult(adultId, source, itemId);
        if (coverage.isPresent()) {
            CoverageAssignmentDto row = coverage.get();
            return new LeaveFromOverride(row.leaveFromPlaceId(), row.leaveFromAddress());
        }
        Optional<CalendarLeaveFromEntity> override =
                leaveFromRepository.findByAdultIdAndItemSourceAndItemId(adultId, source, itemId);
        if (override.isPresent()) {
            CalendarLeaveFromEntity row = override.get();
            return new LeaveFromOverride(row.placeId(), row.leaveFromAddress());
        }
        return LeaveFromOverride.DEFAULT;
    }

    private Optional<CoverageAssignmentDto> activeCoverageForAdult(
            UUID adultId, LeaveByItemSource source, UUID itemId) {
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        return coverageApi.listForItem(circleId, toCoverageSource(source), itemId).stream()
                .filter(row -> ACTIVE_COVERAGE.contains(row.status()))
                .filter(row -> adultId.equals(row.coveringAdultId()))
                .findFirst();
    }

    private Optional<ResolvedOrigin> resolveOriginFields(
            UUID adultId,
            UUID leaveFromPlaceId,
            String leaveFromAddress,
            boolean allowHttp,
            Map<String, Optional<GeoPointDto>> geocoded) {
        if (leaveFromPlaceId != null) {
            return placeApi
                    .findPlaceForMember(adultId, leaveFromPlaceId)
                    .filter(CirclePlaceDto::located)
                    .map(ResolvedOrigin::fromPlace)
                    .or(() -> resolveDefaultAsOrigin(adultId));
        }
        String trimmed = leaveFromAddress == null ? null : leaveFromAddress.trim();
        if (trimmed != null && !trimmed.isEmpty()) {
            Optional<GeoPointDto> point =
                    geocoded.computeIfAbsent(
                            normalizeLocation(trimmed),
                            ignored ->
                                    allowHttp
                                            ? geocodeApi.resolveLocation(trimmed)
                                            : geocodeApi.findCachedLocation(trimmed));
            if (point.isPresent()) {
                return Optional.of(ResolvedOrigin.oneTime(trimmed, point.get()));
            }
            return Optional.of(ResolvedOrigin.oneTimeUnresolved(trimmed));
        }
        return resolveDefaultAsOrigin(adultId);
    }

    private Optional<ResolvedOrigin> resolveDefaultAsOrigin(UUID adultId) {
        return resolveDefaultOrigin(adultId).map(ResolvedOrigin::fromPlace);
    }

    private Optional<ResolvedOrigin> resolveItemOriginLocated(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Map<String, Optional<GeoPointDto>> geocoded) {
        LeaveFromOverride override = leaveFromForAdult(adultId, source, itemId);
        Optional<ResolvedOrigin> origin =
                resolveOriginFields(
                        adultId, override.placeId(), override.address(), true, geocoded);
        if (origin.isEmpty() || !origin.get().located()) {
            return Optional.empty();
        }
        return origin;
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
            String routeKey,
            double fromLat,
            double fromLng,
            double toLat,
            double toLng,
            boolean allowHttp) {
        Optional<RouteCacheEntity> cached = routeCacheRepository.findById(routeKey);
        if (cached.isPresent()) {
            return Optional.of(cached.get().durationSeconds());
        }
        if (!allowHttp) {
            return Optional.empty();
        }
        Optional<Double> live = osrmPort.drivingDurationSeconds(fromLat, fromLng, toLat, toLng);
        live.ifPresent(
                seconds ->
                        routeCacheRepository.save(
                                new RouteCacheEntity(routeKey, seconds, Instant.now())));
        return live;
    }

    static String normalizeLocation(String location) {
        return location == null ? "" : location.trim().toLowerCase(Locale.ROOT);
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
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Optional<ResolvedOrigin> homeOpt =
                resolveItemOriginLocated(drivingAdultId, source, itemId, geocoded);
        if (homeOpt.isEmpty()) {
            return persistRoute(
                    drivingAdultId,
                    source,
                    itemId,
                    "",
                    CalendarRouteDto.unavailable(REASON_NO_ORIGIN, bufferMinutes, List.of()));
        }
        ResolvedOrigin home = homeOpt.get();
        String homeLabel =
                home.placeName() != null
                        ? home.placeName()
                        : (home.oneTimeAddress() == null ? "" : home.oneTimeAddress());
        String homeAddress =
                home.oneTimeAddress() != null
                        ? home.oneTimeAddress()
                        : (home.placeName() == null ? "" : home.placeName());
        // Prefer place address when we have a named place — reload for address text.
        if (home.placeId() != null) {
            Optional<CirclePlaceDto> place = placeApi.findPlaceForMember(drivingAdultId, home.placeId());
            if (place.isPresent() && place.get().address() != null) {
                homeAddress = place.get().address();
            }
        }
        if (destinationAddress == null || destinationAddress.isBlank()) {
            CalendarRouteStopDto homeStop =
                    new CalendarRouteStopDto(
                            homeLabel, homeAddress, CalendarRouteStopKind.HOME, null);
            String fingerprint =
                    ItineraryFingerprint.compute(
                            home.placeId(),
                            home.latitude(),
                            home.longitude(),
                            homeAddress,
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

        Map<String, Optional<Double>> durations = new HashMap<>();

        List<CalendarRouteStopDto> stops = new ArrayList<>();
        List<GeoPointDto> points = new ArrayList<>();
        stops.add(
                new CalendarRouteStopDto(
                        homeLabel, homeAddress, CalendarRouteStopKind.HOME, null));
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
                                home.placeId(),
                                home.latitude(),
                                home.longitude(),
                                homeAddress,
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
                            home.placeId(),
                            home.latitude(),
                            home.longitude(),
                            homeAddress,
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
            double seconds = routed.orElse((double) properties.fallbackDurationSeconds());
            legMinutes.add(minutesFromSeconds(seconds));
        }

        String fingerprint =
                ItineraryFingerprint.compute(
                        home.placeId(),
                        home.latitude(),
                        home.longitude(),
                        homeAddress,
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
            LeaveByItemSource source,
            UUID itemId,
            List<CalendarRoutePickupInput> pickups,
            String destinationAddress) {
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Optional<ResolvedOrigin> homeOpt =
                resolveItemOriginLocated(drivingAdultId, source, itemId, geocoded);
        if (homeOpt.isEmpty()) {
            return Optional.empty();
        }
        ResolvedOrigin home = homeOpt.get();
        String homeAddress =
                home.oneTimeAddress() != null
                        ? home.oneTimeAddress()
                        : "";
        if (home.placeId() != null) {
            Optional<CirclePlaceDto> place = placeApi.findPlaceForMember(drivingAdultId, home.placeId());
            if (place.isPresent() && place.get().address() != null) {
                homeAddress = place.get().address();
            }
        }
        return Optional.of(
                ItineraryFingerprint.compute(
                        home.placeId(),
                        home.latitude(),
                        home.longitude(),
                        homeAddress,
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

    private static CoverageItemSource toCoverageSource(LeaveByItemSource source) {
        return switch (source) {
            case MANUAL -> CoverageItemSource.MANUAL;
            case FEED -> CoverageItemSource.FEED;
        };
    }

    private record LeaveFromOverride(UUID placeId, String address) {
        static final LeaveFromOverride DEFAULT = new LeaveFromOverride(null, null);
    }

    private record ResolvedOrigin(
            UUID placeId,
            String placeName,
            String oneTimeAddress,
            Double latitude,
            Double longitude) {

        static ResolvedOrigin fromPlace(CirclePlaceDto place) {
            return new ResolvedOrigin(
                    place.id(), place.name(), null, place.latitude(), place.longitude());
        }

        static ResolvedOrigin oneTime(String address, GeoPointDto point) {
            return new ResolvedOrigin(null, null, address, point.latitude(), point.longitude());
        }

        static ResolvedOrigin oneTimeUnresolved(String address) {
            return new ResolvedOrigin(null, null, address, null, null);
        }

        boolean located() {
            return latitude != null && longitude != null;
        }
    }
}
