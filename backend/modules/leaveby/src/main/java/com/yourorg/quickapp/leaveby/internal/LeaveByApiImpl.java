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
import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.CalendarRouteMemberRef;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import com.yourorg.quickapp.leaveby.CalendarRouteStopDto;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByVenueDriveDto;
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
    static final String REASON_OSRM_UNAVAILABLE = "OSRM_UNAVAILABLE";

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
        return upsertCalendarRoute(
                drivingAdultId,
                CalendarRouteLeg.TO,
                List.of(new CalendarRouteMemberRef(source, itemId)),
                source,
                itemId,
                eventTitle,
                pickups,
                destinationName,
                destinationAddress);
    }

    @Override
    @Transactional
    public CalendarRouteDto upsertCalendarRoute(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
            String destinationName,
            String destinationAddress) {
        return buildAndPersistCalendarRoute(
                drivingAdultId,
                leg == null ? CalendarRouteLeg.TO : leg,
                requireMembers(memberItems),
                originSource,
                originItemId,
                eventTitle,
                middles == null ? List.of() : middles,
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
        return getOrRefreshCalendarRoute(
                drivingAdultId,
                CalendarRouteLeg.TO,
                List.of(new CalendarRouteMemberRef(source, itemId)),
                source,
                itemId,
                eventTitle,
                pickups,
                destinationName,
                destinationAddress);
    }

    @Override
    @Transactional
    public CalendarRouteDto getOrRefreshCalendarRoute(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
            String destinationName,
            String destinationAddress) {
        CalendarRouteLeg safeLeg = leg == null ? CalendarRouteLeg.TO : leg;
        List<CalendarRouteMemberRef> members = requireMembers(memberItems);
        List<CalendarRoutePickupInput> safeMiddles = middles == null ? List.of() : middles;
        String memberSetKey = MemberSetKeys.compute(members);
        Optional<String> fingerprint =
                currentFingerprint(
                        drivingAdultId, originSource, originItemId, safeMiddles, destinationAddress);
        if (fingerprint.isPresent()) {
            Optional<ItineraryEntity> cached =
                    itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                            drivingAdultId, safeLeg, memberSetKey);
            // Only reuse OK itineraries. UNAVAILABLE must rebuild so soft-skipped
            // geocodes / transient OSRM gaps can recover without a fingerprint change.
            if (cached.isPresent()
                    && cached.get().status() == CalendarRouteStatus.OK
                    && fingerprint.get().equals(cached.get().stopFingerprint())) {
                return toDto(cached.get(), members);
            }
        }
        return buildAndPersistCalendarRoute(
                drivingAdultId,
                safeLeg,
                members,
                originSource,
                originItemId,
                eventTitle,
                safeMiddles,
                destinationName,
                destinationAddress);
    }

    @Override
    @Transactional
    public CalendarRouteDto reorderCalendarRouteMiddles(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            List<String> middleStopIds) {
        return reorderCalendarRouteMiddles(
                drivingAdultId,
                CalendarRouteLeg.TO,
                List.of(new CalendarRouteMemberRef(source, itemId)),
                middleStopIds);
    }

    @Override
    @Transactional
    public CalendarRouteDto reorderCalendarRouteMiddles(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItems,
            List<String> middleStopIds) {
        CalendarRouteLeg safeLeg = leg == null ? CalendarRouteLeg.TO : leg;
        List<CalendarRouteMemberRef> members = requireMembers(memberItems);
        String memberSetKey = MemberSetKeys.compute(members);
        Optional<ItineraryEntity> existing =
                itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        drivingAdultId, safeLeg, memberSetKey);
        if (existing.isEmpty()) {
            throw new FamilyAccessException(HttpStatus.NOT_FOUND, "Calendar route not found");
        }
        ItineraryEntity entity = existing.get();
        CalendarRouteDto current = toDto(entity, members);
        if (current.status() != CalendarRouteStatus.OK) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "Route is not available to reorder");
        }
        List<CalendarRouteStopDto> stops = current.stops();
        if (stops.size() < 2) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "Route is not available to reorder");
        }
        CalendarRouteStopDto fixedStart = stops.getFirst();
        CalendarRouteStopDto fixedEnd = stops.getLast();
        CalendarRouteStopKind expectedMiddle =
                safeLeg == CalendarRouteLeg.FROM
                        ? CalendarRouteStopKind.DROPOFF
                        : CalendarRouteStopKind.PICKUP;
        if (safeLeg == CalendarRouteLeg.TO) {
            if (fixedStart.kind() != CalendarRouteStopKind.HOME
                    || fixedEnd.kind() != CalendarRouteStopKind.DESTINATION) {
                throw new FamilyAccessException(
                        HttpStatus.BAD_REQUEST, "Route is not available to reorder");
            }
        } else if (fixedStart.kind() != CalendarRouteStopKind.DESTINATION
                || fixedEnd.kind() != CalendarRouteStopKind.HOME) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "Route is not available to reorder");
        }
        List<CalendarRouteStopDto> currentMiddles = new ArrayList<>();
        for (int i = 1; i < stops.size() - 1; i++) {
            CalendarRouteStopDto stop = stops.get(i);
            if (stop.kind() != expectedMiddle) {
                throw new FamilyAccessException(
                        HttpStatus.BAD_REQUEST, "Route is not available to reorder");
            }
            currentMiddles.add(stop);
        }
        List<String> requested = middleStopIds == null ? List.of() : middleStopIds;
        List<CalendarRouteStopDto> orderedMiddles =
                matchMiddlePermutation(currentMiddles, requested);

        CalendarRouteMemberRef originRef = members.getFirst();
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Optional<ResolvedOrigin> homeOpt =
                resolveItemOriginLocated(
                        drivingAdultId, originRef.source(), originRef.itemId(), geocoded);
        if (homeOpt.isEmpty() || !homeOpt.get().located()) {
            return persistRoute(
                    drivingAdultId,
                    safeLeg,
                    members,
                    memberSetKey,
                    entity.stopFingerprint(),
                    CalendarRouteDto.unavailable(
                            REASON_NO_ORIGIN,
                            current.bufferMinutes(),
                            List.of(),
                            safeLeg,
                            members));
        }

        String venueAddress =
                safeLeg == CalendarRouteLeg.TO ? fixedEnd.address() : fixedStart.address();
        List<GeoPointDto> points = new ArrayList<>();
        List<CalendarRouteStopDto> newStops = new ArrayList<>();
        if (safeLeg == CalendarRouteLeg.TO) {
            ResolvedOrigin homeOrigin = homeOpt.get();
            points.add(new GeoPointDto(homeOrigin.latitude(), homeOrigin.longitude()));
            newStops.add(fixedStart);
        } else {
            Optional<GeoPointDto> venuePoint =
                    geocoded.computeIfAbsent(
                            normalizeLocation(venueAddress),
                            ignored -> geocodeApi.resolveLocation(venueAddress));
            if (venuePoint.isEmpty()) {
                return persistRoute(
                        drivingAdultId,
                        safeLeg,
                        members,
                        memberSetKey,
                        entity.stopFingerprint(),
                        CalendarRouteDto.unavailable(
                                REASON_GEOCODE_FAILED,
                                current.bufferMinutes(),
                                List.of(),
                                safeLeg,
                                members));
            }
            points.add(venuePoint.get());
            newStops.add(fixedStart);
        }
        for (CalendarRouteStopDto middle : orderedMiddles) {
            Optional<GeoPointDto> point =
                    geocoded.computeIfAbsent(
                            normalizeLocation(middle.address()),
                            ignored -> geocodeApi.resolveLocation(middle.address()));
            if (point.isEmpty()) {
                return persistRoute(
                        drivingAdultId,
                        safeLeg,
                        members,
                        memberSetKey,
                        entity.stopFingerprint(),
                        CalendarRouteDto.unavailable(
                                REASON_GEOCODE_FAILED,
                                current.bufferMinutes(),
                                List.of(),
                                safeLeg,
                                members));
            }
            newStops.add(middle);
            points.add(point.get());
        }
        if (safeLeg == CalendarRouteLeg.TO) {
            Optional<GeoPointDto> destPoint =
                    geocoded.computeIfAbsent(
                            normalizeLocation(venueAddress),
                            ignored -> geocodeApi.resolveLocation(venueAddress));
            if (destPoint.isEmpty()) {
                return persistRoute(
                        drivingAdultId,
                        safeLeg,
                        members,
                        memberSetKey,
                        entity.stopFingerprint(),
                        CalendarRouteDto.unavailable(
                                REASON_GEOCODE_FAILED,
                                current.bufferMinutes(),
                                List.of(),
                                safeLeg,
                                members));
            }
            newStops.add(fixedEnd);
            points.add(destPoint.get());
        } else {
            ResolvedOrigin homeOrigin = homeOpt.get();
            points.add(new GeoPointDto(homeOrigin.latitude(), homeOrigin.longitude()));
            newStops.add(fixedEnd);
        }

        Map<String, Optional<Double>> durations = new HashMap<>();
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
            if (routed.isEmpty()) {
                return persistRoute(
                        drivingAdultId,
                        safeLeg,
                        members,
                        memberSetKey,
                        entity.stopFingerprint(),
                        CalendarRouteDto.unavailable(
                                REASON_OSRM_UNAVAILABLE,
                                current.bufferMinutes(),
                                List.of(),
                                safeLeg,
                                members));
            }
            legMinutes.add(minutesFromSeconds(routed.get()));
        }

        return persistRoute(
                drivingAdultId,
                safeLeg,
                members,
                memberSetKey,
                entity.stopFingerprint(),
                CalendarRouteDto.ok(
                        current.bufferMinutes(), newStops, legMinutes, safeLeg, members));
    }

    @Override
    @Transactional
    public void invalidateCalendarRoute(
            UUID drivingAdultId, LeaveByItemSource source, UUID itemId) {
        List<ItineraryEntity> rows = itineraryRepository.findByDrivingAdultId(drivingAdultId);
        for (ItineraryEntity row : rows) {
            if (MemberSetKeys.tokensContain(row.membersToken(), source, itemId)) {
                itineraryRepository.delete(row);
            }
        }
    }

    @Override
    @Transactional
    public void invalidateCalendarRoutesForItem(LeaveByItemSource source, UUID itemId) {
        String needle = source.name() + "/" + itemId;
        for (ItineraryEntity row : itineraryRepository.findByMembersTokenContaining(needle)) {
            if (MemberSetKeys.tokensContain(row.membersToken(), source, itemId)) {
                itineraryRepository.delete(row);
            }
        }
    }

    @Override
    @Transactional
    public void invalidateCalendarRoutesForDrivingAdult(UUID drivingAdultId) {
        itineraryRepository.deleteByDrivingAdultId(drivingAdultId);
    }

    @Override
    public int arrivalBufferMinutes(String title) {
        return RouteBufferMinutes.forTitle(title);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveByVenueDriveDto> cheapVenueDrives(
            UUID adultId, List<LeaveByItemInput> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Map<String, Optional<Double>> durations = new HashMap<>();
        List<LeaveByVenueDriveDto> out = new ArrayList<>(items.size());
        for (LeaveByItemInput item : items) {
            LeaveFromOverride override =
                    leaveFromForAdult(adultId, item.source(), item.itemId());
            out.add(
                    venueDriveWithOverride(
                            adultId,
                            override.placeId(),
                            override.address(),
                            item.location(),
                            geocoded,
                            durations));
        }
        return List.copyOf(out);
    }

    private LeaveByVenueDriveDto venueDriveWithOverride(
            UUID adultIdForDefault,
            UUID leaveFromPlaceId,
            String leaveFromAddress,
            String location,
            Map<String, Optional<GeoPointDto>> geocoded,
            Map<String, Optional<Double>> durations) {
        Optional<ResolvedOrigin> originOpt =
                resolveOriginFields(
                        adultIdForDefault, leaveFromPlaceId, leaveFromAddress, false, geocoded);
        if (originOpt.isEmpty() || !originOpt.get().located()) {
            // Still try venue identity from dest alone when origin is missing.
            String venueOnly = cachedVenueIdentity(location, geocoded);
            return new LeaveByVenueDriveDto(venueOnly, null);
        }
        if (location == null || location.isBlank()) {
            return LeaveByVenueDriveDto.unavailable();
        }
        String locKey = normalizeLocation(location);
        Optional<GeoPointDto> destination =
                geocoded.computeIfAbsent(
                        locKey, ignored -> geocodeApi.findCachedLocation(location));
        if (destination.isEmpty()) {
            return LeaveByVenueDriveDto.unavailable();
        }
        GeoPointDto dest = destination.get();
        String venueIdentity =
                String.format(
                        Locale.ROOT, "%.6f,%.6f", dest.latitude(), dest.longitude());
        ResolvedOrigin origin = originOpt.get();
        String routeKey =
                LeaveByRouteKeys.routeKey(
                        origin.latitude(),
                        origin.longitude(),
                        dest.latitude(),
                        dest.longitude());
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
                                        false));
        if (routed.isEmpty()) {
            return new LeaveByVenueDriveDto(venueIdentity, null);
        }
        return new LeaveByVenueDriveDto(venueIdentity, (int) Math.round(routed.get()));
    }

    private String cachedVenueIdentity(
            String location, Map<String, Optional<GeoPointDto>> geocoded) {
        if (location == null || location.isBlank()) {
            return null;
        }
        String locKey = normalizeLocation(location);
        Optional<GeoPointDto> destination =
                geocoded.computeIfAbsent(
                        locKey, ignored -> geocodeApi.findCachedLocation(location));
        if (destination.isEmpty()) {
            return null;
        }
        GeoPointDto dest = destination.get();
        return String.format(Locale.ROOT, "%.6f,%.6f", dest.latitude(), dest.longitude());
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
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> members,
            LeaveByItemSource originSource,
            UUID originItemId,
            String eventTitle,
            List<CalendarRoutePickupInput> middles,
            String destinationName,
            String destinationAddress) {
        String memberSetKey = MemberSetKeys.compute(members);
        int bufferMinutes = RouteBufferMinutes.forTitle(eventTitle);
        Map<String, Optional<GeoPointDto>> geocoded = new HashMap<>();
        Optional<ResolvedOrigin> homeOpt =
                resolveItemOriginLocated(drivingAdultId, originSource, originItemId, geocoded);
        if (homeOpt.isEmpty()) {
            return persistRoute(
                    drivingAdultId,
                    leg,
                    members,
                    memberSetKey,
                    "",
                    CalendarRouteDto.unavailable(
                            REASON_NO_ORIGIN, bufferMinutes, List.of(), leg, members));
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
                            middleAddresses(middles),
                            destinationAddress);
            return persistRoute(
                    drivingAdultId,
                    leg,
                    members,
                    memberSetKey,
                    fingerprint,
                    CalendarRouteDto.unavailable(
                            REASON_NO_DESTINATION,
                            bufferMinutes,
                            List.of(homeStop),
                            leg,
                            members));
        }

        Map<String, Optional<Double>> durations = new HashMap<>();

        CalendarRouteStopDto homeStop =
                new CalendarRouteStopDto(
                        homeLabel, homeAddress, CalendarRouteStopKind.HOME, null);
        GeoPointDto homePoint = new GeoPointDto(home.latitude(), home.longitude());

        List<GeocodedMiddle> geocodedMiddles = new ArrayList<>();
        int attemptedMiddles = 0;
        for (CalendarRoutePickupInput middle : middles) {
            if (middle == null || middle.address() == null || middle.address().isBlank()) {
                continue;
            }
            attemptedMiddles++;
            Optional<GeoPointDto> point =
                    geocoded.computeIfAbsent(
                            normalizeLocation(middle.address()),
                            ignored -> geocodeApi.resolveLocation(middle.address()));
            if (point.isEmpty()) {
                // Soft-skip: one free-text / ungeocoded middle must not hide the
                // rest of the route (fixed ends + other middles).
                continue;
            }
            String waypointId = "middle-" + geocodedMiddles.size();
            geocodedMiddles.add(new GeocodedMiddle(middle, point.get(), waypointId));
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
                            middleAddresses(middles),
                            destinationAddress);
            List<CalendarRouteStopDto> partial = new ArrayList<>();
            if (leg == CalendarRouteLeg.TO) {
                partial.add(homeStop);
            }
            for (GeocodedMiddle done : geocodedMiddles) {
                partial.add(middleStop(done.input()));
            }
            return persistRoute(
                    drivingAdultId,
                    leg,
                    members,
                    memberSetKey,
                    fingerprint,
                    CalendarRouteDto.unavailable(
                            REASON_GEOCODE_FAILED, bufferMinutes, List.copyOf(partial), leg, members));
        }
        String destName =
                destinationName == null || destinationName.isBlank()
                        ? destinationAddress
                        : destinationName;
        CalendarRouteStopDto destStop =
                new CalendarRouteStopDto(
                        destName,
                        destinationAddress,
                        CalendarRouteStopKind.DESTINATION,
                        null);
        GeoPointDto destPoint = destination.get();

        List<GeocodedMiddle> orderedMiddles = geocodedMiddles;
        boolean allowFallbackLegs = geocodedMiddles.size() < 2;
        if (geocodedMiddles.size() >= 2) {
            StopSequenceOptimizer.Waypoint startWp =
                    leg == CalendarRouteLeg.TO
                            ? new StopSequenceOptimizer.Waypoint(
                                    "start", homePoint.latitude(), homePoint.longitude())
                            : new StopSequenceOptimizer.Waypoint(
                                    "start", destPoint.latitude(), destPoint.longitude());
            StopSequenceOptimizer.Waypoint endWp =
                    leg == CalendarRouteLeg.TO
                            ? new StopSequenceOptimizer.Waypoint(
                                    "end", destPoint.latitude(), destPoint.longitude())
                            : new StopSequenceOptimizer.Waypoint(
                                    "end", homePoint.latitude(), homePoint.longitude());
            List<StopSequenceOptimizer.Waypoint> middleWps = new ArrayList<>(geocodedMiddles.size());
            for (GeocodedMiddle middle : geocodedMiddles) {
                middleWps.add(
                        new StopSequenceOptimizer.Waypoint(
                                middle.waypointId(),
                                middle.point().latitude(),
                                middle.point().longitude()));
            }
            Optional<List<StopSequenceOptimizer.Waypoint>> optimized =
                    StopSequenceOptimizer.optimizeMiddles(
                            startWp,
                            middleWps,
                            endWp,
                            (from, to) ->
                                    routeDuration(
                                            from.latitude(),
                                            from.longitude(),
                                            to.latitude(),
                                            to.longitude(),
                                            durations));
            if (optimized.isEmpty()) {
                String fingerprint =
                        routeStopFingerprint(
                                home.placeId(),
                                home.latitude(),
                                home.longitude(),
                                homeAddress,
                                middles,
                                destinationAddress,
                                geocodedMiddles.size(),
                                attemptedMiddles);
                return persistRoute(
                        drivingAdultId,
                        leg,
                        members,
                        memberSetKey,
                        fingerprint,
                        CalendarRouteDto.unavailable(
                                REASON_OSRM_UNAVAILABLE, bufferMinutes, List.of(), leg, members));
            }
            Map<String, GeocodedMiddle> middleById = new HashMap<>();
            for (GeocodedMiddle middle : geocodedMiddles) {
                middleById.put(middle.waypointId(), middle);
            }
            orderedMiddles = new ArrayList<>(optimized.get().size());
            for (StopSequenceOptimizer.Waypoint wp : optimized.get()) {
                orderedMiddles.add(middleById.get(wp.id()));
            }
        }

        List<CalendarRouteStopDto> stops = new ArrayList<>();
        List<GeoPointDto> points = new ArrayList<>();
        if (leg == CalendarRouteLeg.TO) {
            stops.add(homeStop);
            points.add(homePoint);
        } else {
            stops.add(destStop);
            points.add(destPoint);
        }
        for (GeocodedMiddle middle : orderedMiddles) {
            stops.add(middleStop(middle.input()));
            points.add(middle.point());
        }
        if (leg == CalendarRouteLeg.TO) {
            stops.add(destStop);
            points.add(destPoint);
        } else {
            stops.add(homeStop);
            points.add(homePoint);
        }

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
            if (routed.isEmpty() && !allowFallbackLegs) {
                String fingerprint =
                        routeStopFingerprint(
                                home.placeId(),
                                home.latitude(),
                                home.longitude(),
                                homeAddress,
                                middles,
                                destinationAddress,
                                geocodedMiddles.size(),
                                attemptedMiddles);
                return persistRoute(
                        drivingAdultId,
                        leg,
                        members,
                        memberSetKey,
                        fingerprint,
                        CalendarRouteDto.unavailable(
                                REASON_OSRM_UNAVAILABLE, bufferMinutes, List.of(), leg, members));
            }
            double seconds = routed.orElse((double) properties.fallbackDurationSeconds());
            legMinutes.add(minutesFromSeconds(seconds));
        }

        String fingerprint =
                routeStopFingerprint(
                        home.placeId(),
                        home.latitude(),
                        home.longitude(),
                        homeAddress,
                        middles,
                        destinationAddress,
                        geocodedMiddles.size(),
                        attemptedMiddles);
        return persistRoute(
                drivingAdultId,
                leg,
                members,
                memberSetKey,
                fingerprint,
                CalendarRouteDto.ok(bufferMinutes, stops, legMinutes, leg, members));
    }

    /**
     * Stop fingerprint that includes soft-skipped middle geocodes (re-hashed so
     * it still fits {@code leaveby_itineraries.stop_fingerprint} VARCHAR(64)).
     */
    private static String routeStopFingerprint(
            UUID homePlaceId,
            double homeLat,
            double homeLng,
            String homeAddress,
            List<CalendarRoutePickupInput> middles,
            String destinationAddress,
            int locatedMiddles,
            int attemptedMiddles) {
        return ItineraryFingerprint.withSoftSkippedPickups(
                ItineraryFingerprint.compute(
                        homePlaceId,
                        homeLat,
                        homeLng,
                        homeAddress,
                        middleAddresses(middles),
                        destinationAddress),
                locatedMiddles,
                attemptedMiddles);
    }

    private Optional<String> currentFingerprint(
            UUID drivingAdultId,
            LeaveByItemSource source,
            UUID itemId,
            List<CalendarRoutePickupInput> middles,
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
                        middleAddresses(middles),
                        destinationAddress));
    }

    private CalendarRouteDto persistRoute(
            UUID drivingAdultId,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> members,
            String memberSetKey,
            String fingerprint,
            CalendarRouteDto route) {
        Instant now = Instant.now();
        String stopsJson = ItineraryJson.writeStops(route.stops());
        String legMinutesJson = ItineraryJson.writeLegMinutes(route.legMinutes());
        String membersToken = MemberSetKeys.membersToken(members);
        CalendarRouteMemberRef anchor = members.getFirst();
        Optional<ItineraryEntity> existing =
                itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        drivingAdultId, leg, memberSetKey);
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
                            anchor.source(),
                            anchor.itemId(),
                            membersToken,
                            now);
        } else {
            itineraryRepository.save(
                    new ItineraryEntity(
                            UUID.randomUUID(),
                            drivingAdultId,
                            anchor.source(),
                            anchor.itemId(),
                            leg,
                            memberSetKey,
                            membersToken,
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

    private static CalendarRouteDto toDto(
            ItineraryEntity entity, List<CalendarRouteMemberRef> members) {
        List<CalendarRouteStopDto> stops = ItineraryJson.readStops(entity.stopsJson());
        List<Integer> legMinutes = ItineraryJson.readLegMinutes(entity.legMinutesJson());
        CalendarRouteLeg leg = entity.leg() == null ? CalendarRouteLeg.TO : entity.leg();
        List<CalendarRouteMemberRef> memberRefs =
                members == null || members.isEmpty()
                        ? List.of(new CalendarRouteMemberRef(entity.itemSource(), entity.itemId()))
                        : members;
        if (entity.status() == CalendarRouteStatus.OK) {
            return CalendarRouteDto.ok(
                    entity.bufferMinutes(), stops, legMinutes, leg, memberRefs);
        }
        return CalendarRouteDto.unavailable(
                entity.reason(), entity.bufferMinutes(), stops, leg, memberRefs);
    }

    private static List<String> middleAddresses(List<CalendarRoutePickupInput> middles) {
        List<String> addresses = new ArrayList<>();
        for (CalendarRoutePickupInput middle : middles) {
            if (middle != null && middle.address() != null && !middle.address().isBlank()) {
                addresses.add(middle.address());
            }
        }
        return addresses;
    }

    /**
     * Match requested middle-stop ids (addresses) as a permutation of the current
     * middle stops. Comparison is normalized (trim + lower-case).
     */
    private static List<CalendarRouteStopDto> matchMiddlePermutation(
            List<CalendarRouteStopDto> currentMiddles, List<String> requestedIds) {
        if (requestedIds.size() != currentMiddles.size()) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "middleStopIds must match current pickup stops");
        }
        List<CalendarRouteStopDto> remaining = new ArrayList<>(currentMiddles);
        List<CalendarRouteStopDto> ordered = new ArrayList<>(currentMiddles.size());
        for (String requestedId : requestedIds) {
            if (requestedId == null || requestedId.isBlank()) {
                throw new FamilyAccessException(
                        HttpStatus.BAD_REQUEST, "middleStopIds must match current pickup stops");
            }
            String key = ItineraryFingerprint.normalize(requestedId);
            int found = -1;
            for (int i = 0; i < remaining.size(); i++) {
                if (ItineraryFingerprint.normalize(remaining.get(i).address()).equals(key)) {
                    found = i;
                    break;
                }
            }
            if (found < 0) {
                throw new FamilyAccessException(
                        HttpStatus.BAD_REQUEST, "middleStopIds must match current pickup stops");
            }
            ordered.add(remaining.remove(found));
        }
        return ordered;
    }

    private static CalendarRouteStopDto middleStop(CalendarRoutePickupInput middle) {
        String name =
                middle.name() == null || middle.name().isBlank()
                        ? middle.address()
                        : middle.name();
        CalendarRouteStopKind kind =
                middle.kind() == null ? CalendarRouteStopKind.PICKUP : middle.kind();
        return new CalendarRouteStopDto(name, middle.address(), kind, middle.contact());
    }

    private static List<CalendarRouteMemberRef> requireMembers(
            List<CalendarRouteMemberRef> memberItems) {
        if (memberItems == null || memberItems.isEmpty()) {
            throw new IllegalArgumentException("member set must not be empty");
        }
        return List.copyOf(memberItems);
    }

    private record GeocodedMiddle(
            CalendarRoutePickupInput input, GeoPointDto point, String waypointId) {}

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
