package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyGeocodeApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.family.GeoPointDto;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
import com.yourorg.quickapp.leaveby.DetourItemInput;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class LeaveByApiImplTest {

    @Mock
    private FamilyMembershipApi membershipApi;

    @Mock
    private FamilyPlaceApi placeApi;

    @Mock
    private FamilyGeocodeApi geocodeApi;

    @Mock
    private ManualEventCalendarApi manualEventCalendarApi;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private CalendarLeaveFromRepository leaveFromRepository;

    @Mock
    private RouteCacheRepository routeCacheRepository;

    @Mock
    private OsrmPort osrmPort;

    private final LeaveByProperties properties =
            new LeaveByProperties(300, 1800, 1.25, 1.0, 7, 9, 16, 19);

    private LeaveByApiImpl api;

    private final UUID adultId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID itemId = UUID.randomUUID();
    private final UUID placeId = UUID.randomUUID();
    private final CirclePlaceDto locatedPlace =
            new CirclePlaceDto(placeId, circleId, "Mom's house", "1 Main", 40.1, -74.1);

    @BeforeEach
    void setUp() {
        api =
                new LeaveByApiImpl(
                        membershipApi,
                        placeApi,
                        geocodeApi,
                        manualEventCalendarApi,
                        feedCalendarApi,
                        leaveFromRepository,
                        routeCacheRepository,
                        osrmPort,
                        properties);
        lenient()
                .when(placeApi.findDefaultLeaveFromForMember(any()))
                .thenReturn(Optional.empty());
        lenient().when(routeCacheRepository.findById(any())).thenReturn(Optional.empty());
        lenient()
                .when(routeCacheRepository.save(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void enrichUnavailableWhenNoLocatedOrigin() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of());

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(result.leaveByReason()).isEqualTo("NO_ORIGIN");
        assertThat(result.leaveByAt()).isNull();
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void enrichUnavailableWhenBlankLocation() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "  ");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(result.leaveByReason()).isEqualTo("NO_DESTINATION");
        assertThat(result.leaveFromPlaceId()).isEqualTo(placeId);
    }

    @Test
    void enrichUnavailableWhenGeocodeFails() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("unlocateable rink")).thenReturn(Optional.empty());

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "unlocateable rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(result.leaveByReason()).isEqualTo("GEOCODE_FAILED");
    }

    @Test
    void enrichOkUsesOsrmDurationAndPeakMultiplier() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(1200.0));

        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z"); // evening peak
        LeaveByEnrichmentDto result =
                api.enrich(adultId, LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(result.leaveByReason()).isNull();
        // 1200 * 1.25 + 300 = 1800s
        assertThat(result.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T16:30:00Z"));
        assertThat(result.leaveFromPlaceName()).isEqualTo("Mom's house");
        verify(routeCacheRepository)
                .save(
                        org.mockito.ArgumentMatchers.argThat(
                                entity ->
                                        entity.routeKey()
                                                        .equals(
                                                                "-74.100000,40.100000;-74.200000,40.200000")
                                                && entity.durationSeconds() == 1200.0));
    }

    @Test
    void enrichUsesFallbackWhenOsrmDown() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Optional.empty());

        Instant startsAt = Instant.parse("2026-08-15T14:00:00Z"); // off-peak
        LeaveByEnrichmentDto result =
                api.enrich(adultId, LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        // fallback 1800 * 1.0 + 300 = 2100s = 35m
        assertThat(result.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T13:25:00Z"));
        verify(routeCacheRepository, never()).save(any());
    }

    @Test
    void enrichUsesMembershipDefaultBeforeNameSortedFallback() {
        UUID homeId = UUID.randomUUID();
        CirclePlaceDto home =
                new CirclePlaceDto(homeId, circleId, "Home", "1 Home", 41.0, -71.0);
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(home));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(41.0, -71.0, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T14:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(result.leaveFromPlaceId()).isEqualTo(homeId);
        assertThat(result.leaveFromPlaceName()).isEqualTo("Home");
        verify(placeApi, never()).listLocatedPlacesForMember(any());
        verify(osrmPort).drivingDurationSeconds(41.0, -71.0, 40.2, -74.2);
    }

    @Test
    void enrichPrefersPerItemOverrideOverMembershipDefault() {
        UUID workId = UUID.randomUUID();
        CirclePlaceDto work =
                new CirclePlaceDto(workId, circleId, "Work", "9 Work", 42.0, -72.0);
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(
                        Optional.of(
                                new CalendarLeaveFromEntity(
                                        UUID.randomUUID(),
                                        adultId,
                                        LeaveByItemSource.MANUAL,
                                        itemId,
                                        workId,
                                        Instant.parse("2026-08-01T00:00:00Z"),
                                        Instant.parse("2026-08-01T00:00:00Z"))));
        when(placeApi.findPlaceForMember(adultId, workId)).thenReturn(Optional.of(work));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(42.0, -72.0, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T14:00:00Z"),
                        "Rink");

        assertThat(result.leaveFromPlaceId()).isEqualTo(workId);
        verify(placeApi, never()).findDefaultLeaveFromForMember(any());
    }

    @Test
    void setLeaveFromPersistsWhenItemExists() {
        when(placeApi.requireLocatedPlaceForMember(adultId, placeId)).thenReturn(locatedPlace);
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId,
                                        "Practice",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        "Rink",
                                        List.of())));
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());

        api.setLeaveFrom(adultId, LeaveByItemSource.MANUAL, itemId, placeId);

        verify(leaveFromRepository).save(any(CalendarLeaveFromEntity.class));
    }

    @Test
    void setLeaveFromUnknownItemIsNotFound() {
        when(placeApi.requireLocatedPlaceForMember(adultId, placeId)).thenReturn(locatedPlace);
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () -> api.setLeaveFrom(adultId, LeaveByItemSource.MANUAL, itemId, placeId))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
        verify(leaveFromRepository, never()).save(any());
    }

    @Test
    void enrichUsesCachedDurationWithoutOsrm() {
        String routeKey = "-74.100000,40.100000;-74.200000,40.200000";
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(routeCacheRepository.findById(routeKey))
                .thenReturn(Optional.of(new RouteCacheEntity(routeKey, 1200.0, Instant.now())));

        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        LeaveByEnrichmentDto result =
                api.enrich(adultId, LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(result.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T16:30:00Z"));
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(routeCacheRepository, never()).save(any());
    }

    @Test
    void enrichCheapPendingDoesNotCallGeocodeOrOsrm() {
        failIfUpstreamHttp();
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.findCachedLocation("Rink")).thenReturn(Optional.empty());

        LeaveByEnrichmentDto result =
                api.enrichCheap(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.PENDING);
        assertThat(result.leaveFromPlaceId()).isEqualTo(placeId);
        assertThat(result.leaveByAt()).isNull();
        verify(geocodeApi, never()).resolveLocation(any());
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void enrichCheapPendingWhenDurationCacheMisses() {
        failIfUpstreamHttp();
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.findCachedLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));

        LeaveByEnrichmentDto result =
                api.enrichCheap(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.PENDING);
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(routeCacheRepository, never()).save(any());
    }

    @Test
    void enrichCheapOkWhenDestAndDurationCached() {
        failIfUpstreamHttp();
        String routeKey = "-74.100000,40.100000;-74.200000,40.200000";
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.findCachedLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(routeCacheRepository.findById(routeKey))
                .thenReturn(Optional.of(new RouteCacheEntity(routeKey, 1200.0, Instant.now())));

        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        LeaveByEnrichmentDto result =
                api.enrichCheap(adultId, LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(result.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T16:30:00Z"));
        verify(geocodeApi, never()).resolveLocation(any());
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void enrichCheapUnavailableWhenBlankLocation() {
        failIfUpstreamHttp();
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));

        LeaveByEnrichmentDto result =
                api.enrichCheap(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "  ");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(result.leaveByReason()).isEqualTo("NO_DESTINATION");
        verify(geocodeApi, never()).findCachedLocation(any());
        verify(geocodeApi, never()).resolveLocation(any());
    }

    @Test
    void enrichManyCollapsesDuplicateLocationAndRoute() {
        UUID secondItem = UUID.randomUUID();
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, secondItem))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(1200.0));

        Instant startsAt = Instant.parse("2026-08-15T17:00:00Z");
        List<LeaveByEnrichmentDto> results =
                api.enrichMany(
                        adultId,
                        List.of(
                                new LeaveByItemInput(
                                        LeaveByItemSource.MANUAL, itemId, startsAt, "Rink"),
                                new LeaveByItemInput(
                                        LeaveByItemSource.MANUAL,
                                        secondItem,
                                        startsAt,
                                        " rink ")));

        assertThat(results).hasSize(2);
        assertThat(results.get(0).leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(results.get(1).leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        verify(geocodeApi, times(1)).resolveLocation(any());
        verify(osrmPort, times(1))
                .drivingDurationSeconds(40.1, -74.1, 40.2, -74.2);
        verify(routeCacheRepository, times(1)).save(any());
    }

    @Test
    void enrichCheapUnavailableWhenNoLocatedOrigin() {
        failIfUpstreamHttp();
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of());

        LeaveByEnrichmentDto result =
                api.enrichCheap(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(result.leaveByReason()).isEqualTo("NO_ORIGIN");
        assertThat(result.leaveByAt()).isNull();
        verify(geocodeApi, never()).findCachedLocation(any());
        verify(geocodeApi, never()).resolveLocation(any());
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void enrichRetriesGeocodeAfterMissIsNotCached() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink")).thenReturn(Optional.empty());

        LeaveByEnrichmentDto miss =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(miss.leaveByStatus()).isEqualTo(LeaveByStatus.UNAVAILABLE);
        assertThat(miss.leaveByReason()).isEqualTo("GEOCODE_FAILED");
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());

        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(1200.0));

        LeaveByEnrichmentDto retry =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(retry.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        verify(geocodeApi, times(2)).resolveLocation("Rink");
    }

    @Test
    void enrichRetriesOsrmAfterFallbackIsNotCached() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(600.0));

        Instant startsAt = Instant.parse("2026-08-15T14:00:00Z");
        LeaveByEnrichmentDto fallback =
                api.enrich(adultId, LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");
        assertThat(fallback.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(fallback.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T13:25:00Z"));
        verify(routeCacheRepository, never()).save(any());

        LeaveByEnrichmentDto retry =
                api.enrich(adultId, LeaveByItemSource.MANUAL, itemId, startsAt, "Rink");
        assertThat(retry.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(retry.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T13:45:00Z"));
        verify(osrmPort, times(2)).drivingDurationSeconds(40.1, -74.1, 40.2, -74.2);
        verify(routeCacheRepository, times(1)).save(any());
    }

    @Test
    void enrichManySecondPassUsesRouteCacheWithoutOsrm() {
        java.util.Map<String, RouteCacheEntity> store = new java.util.HashMap<>();
        when(routeCacheRepository.findById(any()))
                .thenAnswer(
                        invocation ->
                                Optional.ofNullable(store.get(invocation.getArgument(0))));
        when(routeCacheRepository.save(any()))
                .thenAnswer(
                        invocation -> {
                            RouteCacheEntity entity = invocation.getArgument(0);
                            store.put(entity.routeKey(), entity);
                            return entity;
                        });
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(Optional.empty());
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(geocodeApi.findCachedLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(1200.0));

        LeaveByItemInput input =
                new LeaveByItemInput(
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");
        assertThat(api.enrichMany(adultId, List.of(input)).getFirst().leaveByStatus())
                .isEqualTo(LeaveByStatus.OK);
        verify(osrmPort, times(1)).drivingDurationSeconds(40.1, -74.1, 40.2, -74.2);

        assertThat(api.enrichMany(adultId, List.of(input)).getFirst().leaveByStatus())
                .isEqualTo(LeaveByStatus.OK);
        assertThat(api.enrichCheap(adultId, input.source(), input.itemId(), input.startsAt(), input.location())
                        .leaveByStatus())
                .isEqualTo(LeaveByStatus.OK);
        verify(osrmPort, times(1)).drivingDurationSeconds(40.1, -74.1, 40.2, -74.2);
    }

    @Test
    void detourMinutesManyNullWhenNoLocatedOrigin() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of());

        List<Integer> results =
                api.detourMinutesMany(
                        adultId,
                        List.of(new DetourItemInput("12 Oak St, Medford, MA", "Rink")));

        assertThat(results).containsExactly((Integer) null);
        verify(geocodeApi, never()).resolveLocation(any());
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void detourMinutesManyNullWhenAddressOrLocationBlank() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));

        List<Integer> results =
                api.detourMinutesMany(
                        adultId,
                        List.of(
                                new DetourItemInput(" ", "Rink"),
                                new DetourItemInput("12 Oak St", "  ")));

        assertThat(results).containsExactly(null, null);
        verify(geocodeApi, never()).resolveLocation(any());
    }

    @Test
    void detourMinutesManyNullWhenGeocodeFails() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St")).thenReturn(Optional.empty());

        List<Integer> results =
                api.detourMinutesMany(
                        adultId, List.of(new DetourItemInput("12 Oak St", "Rink")));

        assertThat(results).containsExactly((Integer) null);
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void detourMinutesManyNullWhenOsrmUnavailable() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Optional.empty());

        List<Integer> results =
                api.detourMinutesMany(
                        adultId, List.of(new DetourItemInput("12 Oak St", "Rink")));

        assertThat(results).containsExactly((Integer) null);
    }

    @Test
    void detourMinutesManyComputesTwoLegDeltaWithoutFallbackOrPeakMultiplier() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.15, -74.15))
                .thenReturn(Optional.of(300.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        List<Integer> results =
                api.detourMinutesMany(
                        adultId, List.of(new DetourItemInput("12 Oak St", "Rink")));

        assertThat(results).containsExactly(10);
        verify(routeCacheRepository, times(3)).save(any());
    }

    @Test
    void detourMinutesManyUsesDefaultOriginNotPerItemOverride() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.15, -74.15))
                .thenReturn(Optional.of(300.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        List<Integer> results =
                api.detourMinutesMany(
                        adultId, List.of(new DetourItemInput("12 Oak St", "Rink")));

        assertThat(results).containsExactly(10);
        verify(osrmPort).drivingDurationSeconds(40.1, -74.1, 40.2, -74.2);
        verify(placeApi, never()).findPlaceForMember(any(), any());
        verify(leaveFromRepository, never())
                .findByAdultIdAndItemSourceAndItemId(any(), any(), any());
    }

    @Test
    void detourMinutesManyCollapsesDuplicateAddressesAndRoutes() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.15, -74.15))
                .thenReturn(Optional.of(300.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        List<Integer> results =
                api.detourMinutesMany(
                        adultId,
                        List.of(
                                new DetourItemInput("12 Oak St", "Rink"),
                                new DetourItemInput(" 12 oak st ", " rink ")));

        assertThat(results).containsExactly(10, 10);
        verify(geocodeApi, times(1)).resolveLocation("12 Oak St");
        verify(geocodeApi, times(1)).resolveLocation("Rink");
        verify(osrmPort, times(1)).drivingDurationSeconds(40.1, -74.1, 40.2, -74.2);
        verify(osrmPort, times(1)).drivingDurationSeconds(40.1, -74.1, 40.15, -74.15);
        verify(osrmPort, times(1)).drivingDurationSeconds(40.15, -74.15, 40.2, -74.2);
    }

    private void failIfUpstreamHttp() {
        lenient()
                .when(geocodeApi.resolveLocation(any()))
                .thenThrow(new AssertionError("Nominatim HTTP must not run on cheap path"));
        lenient()
                .when(osrmPort.drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(new AssertionError("OSRM HTTP must not run on cheap path"));
    }
}
