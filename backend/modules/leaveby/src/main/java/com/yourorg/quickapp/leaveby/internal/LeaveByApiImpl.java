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
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.time.Instant;
import java.util.List;
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
    private final OsrmPort osrmPort;
    private final LeaveByProperties properties;

    LeaveByApiImpl(
            FamilyMembershipApi membershipApi,
            FamilyPlaceApi placeApi,
            FamilyGeocodeApi geocodeApi,
            ManualEventCalendarApi manualEventCalendarApi,
            FeedCalendarApi feedCalendarApi,
            CalendarLeaveFromRepository leaveFromRepository,
            OsrmPort osrmPort,
            LeaveByProperties properties) {
        this.membershipApi = membershipApi;
        this.placeApi = placeApi;
        this.geocodeApi = geocodeApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.feedCalendarApi = feedCalendarApi;
        this.leaveFromRepository = leaveFromRepository;
        this.osrmPort = osrmPort;
        this.properties = properties;
    }

    @Override
    @Transactional(readOnly = true)
    public LeaveByEnrichmentDto enrich(
            UUID adultId,
            LeaveByItemSource source,
            UUID itemId,
            Instant startsAt,
            String location) {
        Optional<CirclePlaceDto> origin = resolveOrigin(adultId, source, itemId);
        if (origin.isEmpty()) {
            return LeaveByEnrichmentDto.unavailable(null, null, REASON_NO_ORIGIN);
        }
        CirclePlaceDto place = origin.get();
        if (location == null || location.isBlank()) {
            return LeaveByEnrichmentDto.unavailable(
                    place.id(), place.name(), REASON_NO_DESTINATION);
        }
        Optional<GeoPointDto> destination = geocodeApi.resolveLocation(location);
        if (destination.isEmpty()) {
            return LeaveByEnrichmentDto.unavailable(
                    place.id(), place.name(), REASON_GEOCODE_FAILED);
        }
        GeoPointDto dest = destination.get();
        double travelSeconds =
                osrmPort
                        .drivingDurationSeconds(
                                place.latitude(),
                                place.longitude(),
                                dest.latitude(),
                                dest.longitude())
                        .orElse((double) properties.fallbackDurationSeconds());
        double multiplier = LeaveByMath.timeOfDayMultiplier(startsAt, properties);
        Instant leaveByAt =
                LeaveByMath.leaveByAt(
                        startsAt, travelSeconds, multiplier, properties.fixedBufferSeconds());
        return LeaveByEnrichmentDto.ok(place.id(), place.name(), leaveByAt);
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
