package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
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
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import com.yourorg.quickapp.leaveby.CalendarRouteStopDto;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
import com.yourorg.quickapp.leaveby.LeaveFromPlaceDto;
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
    private CoverageApi coverageApi;

    @Mock
    private ManualEventCalendarApi manualEventCalendarApi;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private CalendarLeaveFromRepository leaveFromRepository;

    @Mock
    private RouteCacheRepository routeCacheRepository;

    @Mock
    private ItineraryRepository itineraryRepository;

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
                        coverageApi,
                        manualEventCalendarApi,
                        feedCalendarApi,
                        leaveFromRepository,
                        routeCacheRepository,
                        itineraryRepository,
                        osrmPort,
                        properties);
        lenient()
                .when(membershipApi.requireMemberCircleId(any()))
                .thenReturn(circleId);
        lenient().when(coverageApi.listForItem(any(), any(), any())).thenReturn(List.of());
        lenient()
                .when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(any(), any(), any()))
                .thenReturn(Optional.empty());
        lenient()
                .when(placeApi.findDefaultLeaveFromForMember(any()))
                .thenReturn(Optional.empty());
        lenient().when(placeApi.findPlaceForMember(adultId, placeId)).thenReturn(Optional.of(locatedPlace));
        lenient().when(routeCacheRepository.findById(any())).thenReturn(Optional.empty());
        lenient()
                .when(routeCacheRepository.save(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient()
                .when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(any(), any(), any()))
                .thenReturn(Optional.empty());
        lenient()
                .when(itineraryRepository.save(any()))
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
                                        null,
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

        api.setLeaveFrom(adultId, LeaveByItemSource.MANUAL, itemId, placeId, null);

        verify(leaveFromRepository).save(any(CalendarLeaveFromEntity.class));
    }

    @Test
    void setLeaveFromUnknownItemIsNotFound() {
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(manualEventCalendarApi.findInCircle(circleId, itemId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () -> api.setLeaveFrom(adultId, LeaveByItemSource.MANUAL, itemId, placeId, null))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
        verify(leaveFromRepository, never()).save(any());
        verify(placeApi, never()).requireLocatedPlaceForMember(any(), any());
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

    @Test
    void upsertCalendarRouteUnavailableWhenNoOrigin() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of());

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "vs Thunder",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.UNAVAILABLE);
        assertThat(route.reason()).isEqualTo("NO_ORIGIN");
        assertThat(route.bufferMinutes()).isEqualTo(45);
        assertThat(route.stops()).isEmpty();
        assertThat(route.legMinutes()).isEmpty();
        verify(itineraryRepository).save(any());
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void upsertCalendarRouteBuildsHomePickupDestinationLegs() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.15, -74.15))
                .thenReturn(Optional.of(720.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.2, -74.2))
                .thenReturn(Optional.of(1080.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Kwame",
                                        "12 Oak St",
                                        new CalendarRouteNotifyContact(
                                                CalendarRouteNotifyChannel.PUSH, "the Oseis"))),
                        "Allied Veterans Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.bufferMinutes()).isEqualTo(20);
        assertThat(route.stops()).hasSize(3);
        assertThat(route.stops().get(0).kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().get(1).kind()).isEqualTo(CalendarRouteStopKind.PICKUP);
        assertThat(route.stops().get(1).contact().to()).isEqualTo("the Oseis");
        assertThat(route.stops().get(2).kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
        assertThat(route.legMinutes()).containsExactly(12, 18);
        verify(itineraryRepository).save(any());
        verify(routeCacheRepository, times(2)).save(any());
    }

    @Test
    void upsertCalendarRouteFromLegBuildsVenueDropoffHome() {
        UUID otherItem = UUID.randomUUID();
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.2, -74.2, 40.15, -74.15))
                .thenReturn(Optional.of(600.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.1, -74.1))
                .thenReturn(Optional.of(480.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        CalendarRouteLeg.FROM,
                        List.of(
                                new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                                new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItem)),
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Kwame",
                                        "12 Oak St",
                                        new CalendarRouteNotifyContact(
                                                CalendarRouteNotifyChannel.PUSH, "the Oseis"),
                                        CalendarRouteStopKind.DROPOFF)),
                        "Allied Veterans Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.leg()).isEqualTo(CalendarRouteLeg.FROM);
        assertThat(route.memberItemIds()).hasSize(2);
        assertThat(route.stops()).hasSize(3);
        assertThat(route.stops().get(0).kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
        assertThat(route.stops().get(1).kind()).isEqualTo(CalendarRouteStopKind.DROPOFF);
        assertThat(route.stops().get(2).kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.legMinutes()).containsExactly(10, 8);
    }

    @Test
    void upsertCombinedToIgnoresEarliestItemCoverageLeaveFromForHomeStart() {
        UUID otherItem = UUID.randomUUID();
        UUID schoolPlaceId = UUID.randomUUID();
        CirclePlaceDto school =
                new CirclePlaceDto(schoolPlaceId, circleId, "Haggerty", "9 School Rd", 40.12, -74.12);
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(placeApi.findPlaceForMember(adultId, placeId)).thenReturn(Optional.of(locatedPlace));
        // If origin wrongly used the earliest item, HOME would become Haggerty.
        lenient()
                .when(placeApi.findPlaceForMember(adultId, schoolPlaceId))
                .thenReturn(Optional.of(school));
        lenient()
                .when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.FEED,
                                        itemId,
                                        adultId,
                                        adultId,
                                        List.of(UUID.randomUUID()),
                                        CoverageStatus.CONFIRMED,
                                        schoolPlaceId,
                                        null,
                                        Instant.now(),
                                        Instant.now())));
        when(geocodeApi.resolveLocation("9 School Rd"))
                .thenReturn(Optional.of(new GeoPointDto(40.12, -74.12)));
        when(geocodeApi.resolveLocation("34 Pine St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Optional.of(600.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        CalendarRouteLeg.TO,
                        List.of(
                                new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                                new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItem)),
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Kian · Haggerty", "9 School Rd"),
                                new CalendarRoutePickupInput(
                                        "Apollo",
                                        "34 Pine St",
                                        new CalendarRouteNotifyContact(
                                                CalendarRouteNotifyChannel.PUSH, "House Requester"))),
                        "Simoni",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().getFirst().address()).isEqualTo("1 Main");
        assertThat(route.stops().getFirst().name()).isEqualTo("Mom's house");
        assertThat(route.stops())
                .filteredOn(s -> s.kind() == CalendarRouteStopKind.PICKUP)
                .extracting(CalendarRouteStopDto::address)
                .containsExactlyInAnyOrder("9 School Rd", "34 Pine St");
        assertThat(route.stops().getLast().kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
    }

    @Test
    void upsertSingletonToStillUsesItemCoverageLeaveFromAsHome() {
        UUID schoolPlaceId = UUID.randomUUID();
        CirclePlaceDto school =
                new CirclePlaceDto(schoolPlaceId, circleId, "Haggerty", "9 School Rd", 40.12, -74.12);
        when(placeApi.findPlaceForMember(adultId, schoolPlaceId)).thenReturn(Optional.of(school));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.FEED,
                                        itemId,
                                        adultId,
                                        adultId,
                                        List.of(UUID.randomUUID()),
                                        CoverageStatus.CONFIRMED,
                                        schoolPlaceId,
                                        null,
                                        Instant.now(),
                                        Instant.now())));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.12, -74.12, 40.2, -74.2))
                .thenReturn(Optional.of(480.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        CalendarRouteLeg.TO,
                        List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId)),
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Simoni",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops()).hasSize(2);
        assertThat(route.stops().getFirst().kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().getFirst().address()).isEqualTo("9 School Rd");
        assertThat(route.stops().getFirst().name()).isEqualTo("Haggerty");
        verify(placeApi, never()).findDefaultLeaveFromForMember(adultId);
    }

    @Test
    void pickupLeaveFromForRouteMiddleFallsThroughCoverageDefaultHomeToItemOverride() {
        UUID schoolPlaceId = UUID.randomUUID();
        CirclePlaceDto school =
                new CirclePlaceDto(schoolPlaceId, circleId, "Haggerty", "9 School Rd", 40.12, -74.12);
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(placeApi.findPlaceForMember(adultId, placeId)).thenReturn(Optional.of(locatedPlace));
        when(placeApi.findPlaceForMember(adultId, schoolPlaceId)).thenReturn(Optional.of(school));
        // Coverage force-written to membership default home.
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.FEED,
                                        itemId,
                                        adultId,
                                        adultId,
                                        List.of(UUID.randomUUID()),
                                        CoverageStatus.CONFIRMED,
                                        placeId,
                                        null,
                                        Instant.now(),
                                        Instant.now())));
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.FEED, itemId))
                .thenReturn(
                        Optional.of(
                                new CalendarLeaveFromEntity(
                                        UUID.randomUUID(),
                                        adultId,
                                        LeaveByItemSource.FEED,
                                        itemId,
                                        schoolPlaceId,
                                        null,
                                        Instant.now(),
                                        Instant.now())));

        Optional<LeaveFromPlaceDto> pickup =
                api.pickupLeaveFromForRouteMiddle(adultId, LeaveByItemSource.FEED, itemId);

        assertThat(pickup).isPresent();
        assertThat(pickup.get().address()).isEqualTo("9 School Rd");
        assertThat(pickup.get().placeName()).isEqualTo("Haggerty");
    }

    @Test
    void getOrRefreshSameMemberSetViaDifferentPathItemSharesCacheKey() {
        UUID otherItem = UUID.randomUUID();
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(840.0));

        List<CalendarRouteMemberRef> members =
                List.of(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItem));
        CalendarRouteDto first =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        CalendarRouteLeg.TO,
                        members,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");
        assertThat(first.status()).isEqualTo(CalendarRouteStatus.OK);

        ArgumentCaptor<ItineraryEntity> saved = ArgumentCaptor.forClass(ItineraryEntity.class);
        verify(itineraryRepository).save(saved.capture());
        String memberSetKey = saved.getValue().memberSetKey();

        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.TO, memberSetKey))
                .thenReturn(Optional.of(saved.getValue()));

        CalendarRouteDto second =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        CalendarRouteLeg.TO,
                        members,
                        LeaveByItemSource.FEED,
                        otherItem,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");
        assertThat(second.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(second.legMinutes()).isEqualTo(first.legMinutes());
        verify(itineraryRepository, times(1)).save(any());
    }

    @Test
    void upsertCalendarRouteOptimizesPickupOrderForTwoPlusMiddles() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        // Far pickup first in input; near pickup second — optimize should swap.
        when(geocodeApi.resolveLocation("Far St"))
                .thenReturn(Optional.of(new GeoPointDto(40.3, -74.3)));
        when(geocodeApi.resolveLocation("Near St"))
                .thenReturn(Optional.of(new GeoPointDto(40.12, -74.12)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        // home → near short; home → far long
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.12, -74.12))
                .thenReturn(Optional.of(120.0));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.3, -74.3))
                .thenReturn(Optional.of(1800.0));
        when(osrmPort.drivingDurationSeconds(40.12, -74.12, 40.3, -74.3))
                .thenReturn(Optional.of(1500.0));
        when(osrmPort.drivingDurationSeconds(40.3, -74.3, 40.12, -74.12))
                .thenReturn(Optional.of(1500.0));
        when(osrmPort.drivingDurationSeconds(40.12, -74.12, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));
        when(osrmPort.drivingDurationSeconds(40.3, -74.3, 40.2, -74.2))
                .thenReturn(Optional.of(300.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput("Far kid", "Far St"),
                                new CalendarRoutePickupInput("Near kid", "Near St")),
                        "Allied Veterans Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops()).hasSize(4);
        assertThat(route.stops().get(1).name()).isEqualTo("Near kid");
        assertThat(route.stops().get(1).address()).isEqualTo("Near St");
        assertThat(route.stops().get(2).name()).isEqualTo("Far kid");
        assertThat(route.stops().get(2).address()).isEqualTo("Far St");
        assertThat(route.legMinutes()).containsExactly(2, 25, 5);
    }

    @Test
    void upsertCalendarRouteUnavailableWhenOptimizeDurationsMissing() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("12 Oak St"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("22 Pine St"))
                .thenReturn(Optional.of(new GeoPointDto(40.16, -74.16)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Optional.empty());

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput("A", "12 Oak St"),
                                new CalendarRoutePickupInput("B", "22 Pine St")),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.UNAVAILABLE);
        assertThat(route.reason()).isEqualTo("OSRM_UNAVAILABLE");
        assertThat(route.legMinutes()).isEmpty();
        verify(routeCacheRepository, never()).save(any());
    }

    @Test
    void getOrRefreshCalendarRouteReoptimizesWhenFingerprintChanges() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        ItineraryEntity stale =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "stale-fingerprint",
                        ItineraryJson.writeStops(
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Mom's house",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Far kid",
                                                "Far St",
                                                CalendarRouteStopKind.PICKUP,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Near kid",
                                                "Near St",
                                                CalendarRouteStopKind.PICKUP,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "65 Elm St",
                                                CalendarRouteStopKind.DESTINATION,
                                                null))),
                        ItineraryJson.writeLegMinutes(List.of(30, 25, 5)),
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.of(stale));
        when(geocodeApi.resolveLocation("Far St"))
                .thenReturn(Optional.of(new GeoPointDto(40.3, -74.3)));
        when(geocodeApi.resolveLocation("Near St"))
                .thenReturn(Optional.of(new GeoPointDto(40.12, -74.12)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.12, -74.12))
                .thenReturn(Optional.of(120.0));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.3, -74.3))
                .thenReturn(Optional.of(1800.0));
        when(osrmPort.drivingDurationSeconds(40.12, -74.12, 40.3, -74.3))
                .thenReturn(Optional.of(1500.0));
        when(osrmPort.drivingDurationSeconds(40.3, -74.3, 40.12, -74.12))
                .thenReturn(Optional.of(1500.0));
        when(osrmPort.drivingDurationSeconds(40.12, -74.12, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));
        when(osrmPort.drivingDurationSeconds(40.3, -74.3, 40.2, -74.2))
                .thenReturn(Optional.of(300.0));

        CalendarRouteDto route =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(
                                new CalendarRoutePickupInput("Far kid", "Far St"),
                                new CalendarRoutePickupInput("Near kid", "Near St")),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().get(1).address()).isEqualTo("Near St");
        assertThat(route.stops().get(2).address()).isEqualTo("Far St");
        assertThat(route.legMinutes()).containsExactly(2, 25, 5);
        assertThat(stale.stopFingerprint())
                .isEqualTo(
                        ItineraryFingerprint.compute(
                                placeId,
                                40.1,
                                -74.1,
                                "1 Main",
                                List.of("Far St", "Near St"),
                                "65 Elm St"));
    }

    @Test
    void reorderCalendarRouteMiddlesPersistsOrderUnderSameFingerprint() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        String fingerprint =
                ItineraryFingerprint.compute(
                        placeId,
                        40.1,
                        -74.1,
                        "1 Main",
                        List.of("Near St", "Far St"),
                        "65 Elm St");
        ItineraryEntity cached =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        fingerprint,
                        ItineraryJson.writeStops(
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Mom's house",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Near kid",
                                                "Near St",
                                                CalendarRouteStopKind.PICKUP,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Far kid",
                                                "Far St",
                                                CalendarRouteStopKind.PICKUP,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "65 Elm St",
                                                CalendarRouteStopKind.DESTINATION,
                                                null))),
                        ItineraryJson.writeLegMinutes(List.of(2, 25, 5)),
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.of(cached));
        when(geocodeApi.resolveLocation("Near St"))
                .thenReturn(Optional.of(new GeoPointDto(40.12, -74.12)));
        when(geocodeApi.resolveLocation("Far St"))
                .thenReturn(Optional.of(new GeoPointDto(40.3, -74.3)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.3, -74.3))
                .thenReturn(Optional.of(1800.0));
        when(osrmPort.drivingDurationSeconds(40.3, -74.3, 40.12, -74.12))
                .thenReturn(Optional.of(1500.0));
        when(osrmPort.drivingDurationSeconds(40.12, -74.12, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        CalendarRouteDto route =
                api.reorderCalendarRouteMiddles(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        List.of("Far St", "Near St"));

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().get(1).address()).isEqualTo("Far St");
        assertThat(route.stops().get(2).address()).isEqualTo("Near St");
        assertThat(route.legMinutes()).containsExactly(30, 25, 15);
        assertThat(cached.stopFingerprint()).isEqualTo(fingerprint);
        assertThat(ItineraryJson.readStops(cached.stopsJson()).get(1).address()).isEqualTo("Far St");
    }

    @Test
    void reorderCalendarRouteMiddlesRejectsMismatchedIds() {
        String fingerprint = "fp";
        ItineraryEntity cached =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        fingerprint,
                        ItineraryJson.writeStops(
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Home", "1 Main", CalendarRouteStopKind.HOME, null),
                                        new CalendarRouteStopDto(
                                                "A", "A St", CalendarRouteStopKind.PICKUP, null),
                                        new CalendarRouteStopDto(
                                                "B", "B St", CalendarRouteStopKind.PICKUP, null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "65 Elm St",
                                                CalendarRouteStopKind.DESTINATION,
                                                null))),
                        ItineraryJson.writeLegMinutes(List.of(1, 2, 3)),
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.of(cached));

        assertThatThrownBy(
                        () ->
                                api.reorderCalendarRouteMiddles(
                                        adultId,
                                        LeaveByItemSource.FEED,
                                        itemId,
                                        List.of("A St", "Unknown St")))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void reorderCalendarRouteMiddlesNotFoundWhenMissing() {
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                api.reorderCalendarRouteMiddles(
                                        adultId, LeaveByItemSource.FEED, itemId, List.of()))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void upsertCalendarRouteUsesFallbackWhenOsrmMissesAndStillOk() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Optional.empty());

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        "Dentist",
                        List.of(),
                        "Clinic",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.bufferMinutes()).isEqualTo(0);
        assertThat(route.legMinutes()).containsExactly(30); // fallback 1800s
        verify(routeCacheRepository, never()).save(any());
    }

    @Test
    void upsertCalendarRouteUnavailableWhenGeocodeFails() {
        when(placeApi.listLocatedPlacesForMember(adultId)).thenReturn(List.of(locatedPlace));
        when(geocodeApi.resolveLocation("65 Elm St")).thenReturn(Optional.empty());

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Game night",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.UNAVAILABLE);
        assertThat(route.reason()).isEqualTo("GEOCODE_FAILED");
        assertThat(route.bufferMinutes()).isEqualTo(45);
        assertThat(route.legMinutes()).isEmpty();
    }

    @Test
    void upsertCalendarRouteSkipsUngeocodedPickupAndKeepsOtherStops() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("50 broadway cambridge ma")).thenReturn(Optional.empty());
        when(geocodeApi.resolveLocation("109 Fresh Pond Pkwy"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.15, -74.15))
                .thenReturn(Optional.of(300.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.2, -74.2))
                .thenReturn(Optional.of(480.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Edelman", "50 broadway cambridge ma"),
                                new CalendarRoutePickupInput(
                                        "Sharks Family", "109 Fresh Pond Pkwy")),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops()).hasSize(3);
        assertThat(route.stops().get(0).kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().get(1).name()).isEqualTo("Sharks Family");
        assertThat(route.stops().get(1).address()).isEqualTo("109 Fresh Pond Pkwy");
        assertThat(route.stops().get(2).kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
        assertThat(route.legMinutes()).containsExactly(5, 8);

        ArgumentCaptor<ItineraryEntity> saved = ArgumentCaptor.forClass(ItineraryEntity.class);
        verify(itineraryRepository).save(saved.capture());
        // Soft-skip must not append past VARCHAR(64) (accept ride was 500ing).
        assertThat(saved.getValue().stopFingerprint()).hasSize(64);
        String baseOnly =
                ItineraryFingerprint.compute(
                        placeId,
                        40.1,
                        -74.1,
                        "1 Main",
                        List.of("50 broadway cambridge ma", "109 Fresh Pond Pkwy"),
                        "65 Elm St");
        assertThat(saved.getValue().stopFingerprint()).isNotEqualTo(baseOnly);
    }

    @Test
    void getOrRefreshCalendarRouteReturnsCachedWhenFingerprintMatches() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        String fingerprint =
                ItineraryFingerprint.compute(
                        placeId, 40.1, -74.1, "1 Main", List.of(), "65 Elm St");
        String stopsJson =
                ItineraryJson.writeStops(
                        List.of(
                                new CalendarRouteStopDto(
                                        "Mom's house", "1 Main", CalendarRouteStopKind.HOME, null),
                                new CalendarRouteStopDto(
                                        "Rink",
                                        "65 Elm St",
                                        CalendarRouteStopKind.DESTINATION,
                                        null)));
        String legsJson = ItineraryJson.writeLegMinutes(List.of(14));
        ItineraryEntity cached =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        fingerprint,
                        stopsJson,
                        legsJson,
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.of(cached));

        CalendarRouteDto route =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.legMinutes()).containsExactly(14);
        verify(geocodeApi, never()).resolveLocation(any());
        verify(osrmPort, never()).drivingDurationSeconds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(itineraryRepository, never()).save(any());
    }

    @Test
    void getOrRefreshCalendarRouteRebuildsCachedUnavailableEvenWhenFingerprintMatches() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        String fingerprint =
                ItineraryFingerprint.compute(
                        placeId,
                        40.1,
                        -74.1,
                        "1 Main",
                        List.of("50 broadway cambridge ma", "109 Fresh Pond Pkwy"),
                        "65 Elm St");
        ItineraryEntity staleUnavailable =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.UNAVAILABLE,
                        "GEOCODE_FAILED",
                        20,
                        fingerprint,
                        ItineraryJson.writeStops(List.of()),
                        ItineraryJson.writeLegMinutes(List.of()),
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.of(staleUnavailable));
        when(geocodeApi.resolveLocation("50 broadway cambridge ma")).thenReturn(Optional.empty());
        when(geocodeApi.resolveLocation("109 Fresh Pond Pkwy"))
                .thenReturn(Optional.of(new GeoPointDto(40.15, -74.15)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.15, -74.15))
                .thenReturn(Optional.of(300.0));
        when(osrmPort.drivingDurationSeconds(40.15, -74.15, 40.2, -74.2))
                .thenReturn(Optional.of(480.0));

        CalendarRouteDto route =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Tuesday Practice",
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Edelman", "50 broadway cambridge ma"),
                                new CalendarRoutePickupInput(
                                        "Sharks Family", "109 Fresh Pond Pkwy")),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops()).hasSize(3);
        assertThat(route.stops().get(1).address()).isEqualTo("109 Fresh Pond Pkwy");
        verify(geocodeApi, times(2)).resolveLocation("50 broadway cambridge ma");
        verify(geocodeApi, times(2)).resolveLocation("109 Fresh Pond Pkwy");
        assertThat(staleUnavailable.status()).isEqualTo(CalendarRouteStatus.OK);
    }

    @Test
    void getOrRefreshCalendarRouteRecomputesWhenFingerprintChanges() {
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        ItineraryEntity stale =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        45,
                        "stale-fingerprint",
                        ItineraryJson.writeStops(List.of()),
                        ItineraryJson.writeLegMinutes(List.of()),
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        eq(adultId), eq(CalendarRouteLeg.TO), any()))
                .thenReturn(Optional.of(stale));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(840.0));

        CalendarRouteDto route =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "vs Thunder",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.bufferMinutes()).isEqualTo(45);
        assertThat(route.legMinutes()).containsExactly(14);
        assertThat(stale.stopFingerprint())
                .isEqualTo(
                        ItineraryFingerprint.compute(
                                placeId, 40.1, -74.1, "1 Main", List.of(), "65 Elm St"));
        verify(geocodeApi).resolveLocation("65 Elm St");
    }

    @Test
    void invalidateCalendarRouteDeletesRow() {
        ItineraryEntity row =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(
                                List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        MemberSetKeys.membersToken(
                                List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "fp",
                        "[]",
                        "[]",
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByDrivingAdultId(adultId)).thenReturn(List.of(row));
        api.invalidateCalendarRoute(adultId, LeaveByItemSource.FEED, itemId);
        verify(itineraryRepository).delete(row);
    }

    @Test
    void invalidateCalendarRoutesForItemDeletesAllDrivers() {
        ItineraryEntity row =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        CalendarRouteLeg.TO,
                        MemberSetKeys.compute(
                                List.of(
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.MANUAL, itemId))),
                        MemberSetKeys.membersToken(
                                List.of(
                                        new CalendarRouteMemberRef(
                                                LeaveByItemSource.MANUAL, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "fp",
                        "[]",
                        "[]",
                        Instant.now(),
                        Instant.now());
        when(itineraryRepository.findByMembersTokenContaining("MANUAL/" + itemId))
                .thenReturn(List.of(row));
        api.invalidateCalendarRoutesForItem(LeaveByItemSource.MANUAL, itemId);
        verify(itineraryRepository).delete(row);
    }

    @Test
    void invalidateCalendarRoutesForDrivingAdultDeletesAllItems() {
        api.invalidateCalendarRoutesForDrivingAdult(adultId);
        verify(itineraryRepository).deleteByDrivingAdultId(adultId);
    }

    @Test
    void enrichMirrorsActiveCoverageLeaveFromOverItemOverride() {
        UUID coveragePlaceId = UUID.randomUUID();
        CirclePlaceDto coveragePlace =
                new CirclePlaceDto(coveragePlaceId, circleId, "School", "2 School", 43.0, -73.0);
        UUID itemOverridePlaceId = UUID.randomUUID();
        when(coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, itemId))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.MANUAL,
                                        itemId,
                                        adultId,
                                        adultId,
                                        List.of(UUID.randomUUID()),
                                        CoverageStatus.CONFIRMED,
                                        coveragePlaceId,
                                        null,
                                        Instant.now(),
                                        Instant.now())));
        when(placeApi.findPlaceForMember(adultId, coveragePlaceId))
                .thenReturn(Optional.of(coveragePlace));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(43.0, -73.0, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T14:00:00Z"),
                        "Rink");

        assertThat(result.leaveFromPlaceId()).isEqualTo(coveragePlaceId);
        assertThat(result.leaveFromPlaceName()).isEqualTo("School");
        verify(leaveFromRepository, never())
                .findByAdultIdAndItemSourceAndItemId(any(), any(), any());
        verify(placeApi, never()).findPlaceForMember(adultId, itemOverridePlaceId);
    }

    @Test
    void enrichOneTimeItemOverrideGeocodesOrigin() {
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(
                        Optional.of(
                                new CalendarLeaveFromEntity(
                                        UUID.randomUUID(),
                                        adultId,
                                        LeaveByItemSource.MANUAL,
                                        itemId,
                                        null,
                                        "Jack's house",
                                        Instant.now(),
                                        Instant.now())));
        when(geocodeApi.resolveLocation("Jack's house"))
                .thenReturn(Optional.of(new GeoPointDto(40.5, -74.5)));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.5, -74.5, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        LeaveByEnrichmentDto result =
                api.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T14:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(result.leaveFromPlaceId()).isNull();
        assertThat(result.leaveFromAddress()).isEqualTo("Jack's house");
        assertThat(result.leaveByAt()).isEqualTo(Instant.parse("2026-08-15T13:40:00Z"));
    }

    @Test
    void enrichCheapOneTimePendingWhenOriginNotCached() {
        failIfUpstreamHttp();
        when(leaveFromRepository.findByAdultIdAndItemSourceAndItemId(
                        adultId, LeaveByItemSource.MANUAL, itemId))
                .thenReturn(
                        Optional.of(
                                new CalendarLeaveFromEntity(
                                        UUID.randomUUID(),
                                        adultId,
                                        LeaveByItemSource.MANUAL,
                                        itemId,
                                        null,
                                        "playground",
                                        Instant.now(),
                                        Instant.now())));
        when(geocodeApi.findCachedLocation("playground")).thenReturn(Optional.empty());

        LeaveByEnrichmentDto result =
                api.enrichCheap(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        Instant.parse("2026-08-15T17:00:00Z"),
                        "Rink");

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.PENDING);
        assertThat(result.leaveFromAddress()).isEqualTo("playground");
        verify(geocodeApi, never()).resolveLocation(any());
    }

    @Test
    void enrichForLeaveFromUsesCoverageOneTimeWithoutLookingUpItemOverride() {
        when(geocodeApi.resolveLocation("Community Center lot"))
                .thenReturn(Optional.of(new GeoPointDto(41.1, -71.1)));
        when(geocodeApi.resolveLocation("Rink"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(41.1, -71.1, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        LeaveByEnrichmentDto result =
                api.enrichForLeaveFrom(
                        adultId,
                        null,
                        "Community Center lot",
                        Instant.parse("2026-08-15T14:00:00Z"),
                        "Rink",
                        true);

        assertThat(result.leaveByStatus()).isEqualTo(LeaveByStatus.OK);
        assertThat(result.leaveFromAddress()).isEqualTo("Community Center lot");
        verify(leaveFromRepository, never())
                .findByAdultIdAndItemSourceAndItemId(any(), any(), any());
        verify(coverageApi, never()).listForItem(any(), any(), any());
    }

    @Test
    void setLeaveFromOneTimePersistsAddress() {
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

        api.setLeaveFrom(adultId, LeaveByItemSource.MANUAL, itemId, null, "  Jack's house  ");

        org.mockito.ArgumentCaptor<CalendarLeaveFromEntity> saved =
                org.mockito.ArgumentCaptor.forClass(CalendarLeaveFromEntity.class);
        verify(leaveFromRepository).save(saved.capture());
        assertThat(saved.getValue().placeId()).isNull();
        assertThat(saved.getValue().leaveFromAddress()).isEqualTo("Jack's house");
        verify(placeApi, never()).requireLocatedPlaceForMember(any(), any());
    }

    @Test
    void setLeaveFromClearDeletesRow() {
        CalendarLeaveFromEntity existing =
                new CalendarLeaveFromEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.MANUAL,
                        itemId,
                        placeId,
                        null,
                        Instant.now(),
                        Instant.now());
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
                .thenReturn(Optional.of(existing));

        api.setLeaveFrom(adultId, LeaveByItemSource.MANUAL, itemId, null, null);

        verify(leaveFromRepository).delete(existing);
        verify(leaveFromRepository, never()).save(any());
    }

    @Test
    void upsertCalendarRouteUsesCoverageLeaveFromNotDefaultHome() {
        UUID coveragePlaceId = UUID.randomUUID();
        CirclePlaceDto school =
                new CirclePlaceDto(coveragePlaceId, circleId, "School", "2 School Rd", 43.0, -73.0);
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, itemId))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.FEED,
                                        itemId,
                                        adultId,
                                        adultId,
                                        List.of(UUID.randomUUID()),
                                        CoverageStatus.CONFIRMED,
                                        coveragePlaceId,
                                        null,
                                        Instant.now(),
                                        Instant.now())));
        when(placeApi.findPlaceForMember(adultId, coveragePlaceId)).thenReturn(Optional.of(school));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(43.0, -73.0, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().name()).isEqualTo("School");
        assertThat(route.stops().getFirst().address()).isEqualTo("2 School Rd");
        verify(placeApi, never()).findDefaultLeaveFromForMember(any());
        verify(placeApi, never()).listLocatedPlacesForMember(any());
    }

    @Test
    void combinedRouteUsesItineraryHomeSideOverrideAsHomeStart() {
        UUID otherItemId = UUID.randomUUID();
        UUID officeId = UUID.randomUUID();
        CirclePlaceDto office =
                new CirclePlaceDto(officeId, circleId, "Office", "500 Market", 41.0, -75.0);
        List<CalendarRouteMemberRef> members =
                List.of(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItemId));
        String memberSetKey = MemberSetKeys.compute(members);
        ItineraryEntity withOverride =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        memberSetKey,
                        MemberSetKeys.membersToken(members),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "stale",
                        "[]",
                        "[]",
                        Instant.now(),
                        Instant.now());
        withOverride.setHomeSideOverride(officeId, null, Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.TO, memberSetKey))
                .thenReturn(Optional.of(withOverride));
        when(placeApi.findPlaceForMember(adultId, officeId)).thenReturn(Optional.of(office));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(41.0, -75.0, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        CalendarRouteLeg.TO,
                        members,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().getFirst().name()).isEqualTo("Office");
        assertThat(route.stops().getFirst().address()).isEqualTo("500 Market");
        assertThat(withOverride.stopFingerprint())
                .isEqualTo(
                        ItineraryFingerprint.compute(
                                officeId, 41.0, -75.0, "500 Market", List.of(), "65 Elm St"));
        verify(placeApi, never()).findDefaultLeaveFromForMember(any());
    }

    @Test
    void combinedRouteFlattensMiddleMatchingHomeSideOverride() {
        UUID otherItemId = UUID.randomUUID();
        UUID officeId = UUID.randomUUID();
        CirclePlaceDto office =
                new CirclePlaceDto(officeId, circleId, "Office", "500 Market", 41.0, -75.0);
        List<CalendarRouteMemberRef> members =
                List.of(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItemId));
        String memberSetKey = MemberSetKeys.compute(members);
        ItineraryEntity withOverride =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        memberSetKey,
                        MemberSetKeys.membersToken(members),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "stale",
                        "[]",
                        "[]",
                        Instant.now(),
                        Instant.now());
        withOverride.setHomeSideOverride(officeId, null, Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.TO, memberSetKey))
                .thenReturn(Optional.of(withOverride));
        when(placeApi.findPlaceForMember(adultId, officeId)).thenReturn(Optional.of(office));
        when(geocodeApi.resolveLocation("10 Community"))
                .thenReturn(Optional.of(new GeoPointDto(41.2, -75.2)));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(41.0, -75.0, 41.2, -75.2))
                .thenReturn(Optional.of(300.0));
        when(osrmPort.drivingDurationSeconds(41.2, -75.2, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        CalendarRouteLeg.TO,
                        members,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Kid · Office", "500 Market", null, CalendarRouteStopKind.PICKUP),
                                new CalendarRoutePickupInput(
                                        "Afterschool",
                                        "10 Community",
                                        null,
                                        CalendarRouteStopKind.PICKUP)),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops()).hasSize(3);
        assertThat(route.stops().get(0).kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().get(0).address()).isEqualTo("500 Market");
        assertThat(route.stops().get(1).name()).isEqualTo("Afterschool");
        assertThat(route.stops().get(2).kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
    }

    @Test
    void getOrRefreshRebuildsWhenHomeSideOverrideChangesFingerprint() {
        UUID officeId = UUID.randomUUID();
        CirclePlaceDto office =
                new CirclePlaceDto(officeId, circleId, "Office", "500 Market", 41.0, -75.0);
        String memberSetKey =
                MemberSetKeys.compute(
                        List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId)));
        String homeFingerprint =
                ItineraryFingerprint.compute(
                        placeId, 40.1, -74.1, "1 Main", List.of(), "65 Elm St");
        ItineraryEntity cached =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        memberSetKey,
                        MemberSetKeys.membersToken(
                                List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId))),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        homeFingerprint,
                        ItineraryJson.writeStops(
                                List.of(
                                        new CalendarRouteStopDto(
                                                "Mom's house",
                                                "1 Main",
                                                CalendarRouteStopKind.HOME,
                                                null),
                                        new CalendarRouteStopDto(
                                                "Rink",
                                                "65 Elm St",
                                                CalendarRouteStopKind.DESTINATION,
                                                null))),
                        ItineraryJson.writeLegMinutes(List.of(14)),
                        Instant.now(),
                        Instant.now());
        cached.setHomeSideOverride(officeId, null, Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.TO, memberSetKey))
                .thenReturn(Optional.of(cached));
        when(placeApi.findPlaceForMember(adultId, officeId)).thenReturn(Optional.of(office));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(41.0, -75.0, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        CalendarRouteDto route =
                api.getOrRefreshCalendarRoute(
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().name()).isEqualTo("Office");
        assertThat(route.legMinutes()).containsExactly(15);
        assertThat(cached.stopFingerprint())
                .isEqualTo(
                        ItineraryFingerprint.compute(
                                officeId, 41.0, -75.0, "500 Market", List.of(), "65 Elm St"));
    }

    @Test
    void fromRouteUsesIndependentHomeSideOverrideAsHomeEnd() {
        UUID homeOverrideId = UUID.randomUUID();
        CirclePlaceDto grandma =
                new CirclePlaceDto(homeOverrideId, circleId, "Grandma", "9 Oak", 42.0, -76.0);
        List<CalendarRouteMemberRef> members =
                List.of(new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId));
        String memberSetKey = MemberSetKeys.compute(members);
        ItineraryEntity withOverride =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.FROM,
                        memberSetKey,
                        MemberSetKeys.membersToken(members),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "stale",
                        "[]",
                        "[]",
                        Instant.now(),
                        Instant.now());
        withOverride.setHomeSideOverride(homeOverrideId, null, Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.FROM, memberSetKey))
                .thenReturn(Optional.of(withOverride));
        when(placeApi.findPlaceForMember(adultId, homeOverrideId)).thenReturn(Optional.of(grandma));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.2, -74.2, 42.0, -76.0))
                .thenReturn(Optional.of(1200.0));

        CalendarRouteDto route =
                api.upsertCalendarRoute(
                        adultId,
                        CalendarRouteLeg.FROM,
                        members,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St");

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.leg()).isEqualTo(CalendarRouteLeg.FROM);
        assertThat(route.stops().getFirst().kind()).isEqualTo(CalendarRouteStopKind.DESTINATION);
        assertThat(route.stops().getLast().kind()).isEqualTo(CalendarRouteStopKind.HOME);
        assertThat(route.stops().getLast().name()).isEqualTo("Grandma");
        assertThat(route.stops().getLast().address()).isEqualTo("9 Oak");
        verify(placeApi, never()).findDefaultLeaveFromForMember(any());
    }

    @Test
    void setCalendarRouteOriginPersistsOverrideAndRebuildsWithoutTouchingItemLeaveFrom() {
        UUID otherItemId = UUID.randomUUID();
        UUID officeId = UUID.randomUUID();
        CirclePlaceDto office =
                new CirclePlaceDto(officeId, circleId, "Office", "500 Market", 41.0, -75.0);
        List<CalendarRouteMemberRef> members =
                List.of(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItemId));
        String memberSetKey = MemberSetKeys.compute(members);
        java.util.concurrent.atomic.AtomicReference<ItineraryEntity> stored =
                new java.util.concurrent.atomic.AtomicReference<>();
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.TO, memberSetKey))
                .thenAnswer(invocation -> Optional.ofNullable(stored.get()));
        when(itineraryRepository.save(any(ItineraryEntity.class)))
                .thenAnswer(
                        invocation -> {
                            ItineraryEntity entity = invocation.getArgument(0);
                            stored.set(entity);
                            return entity;
                        });
        when(placeApi.requireLocatedPlaceForMember(adultId, officeId)).thenReturn(office);
        when(placeApi.findPlaceForMember(adultId, officeId)).thenReturn(Optional.of(office));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(41.0, -75.0, 40.2, -74.2))
                .thenReturn(Optional.of(900.0));

        CalendarRouteDto route =
                api.setCalendarRouteOrigin(
                        adultId,
                        CalendarRouteLeg.TO,
                        members,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St",
                        officeId,
                        null);

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().name()).isEqualTo("Office");
        assertThat(route.stops().getFirst().address()).isEqualTo("500 Market");
        assertThat(stored.get().homePlaceId()).isEqualTo(officeId);
        assertThat(stored.get().homeAddress()).isNull();
        verify(leaveFromRepository, never()).save(any());
        verify(leaveFromRepository, never()).delete(any());
    }

    @Test
    void setCalendarRouteOriginClearRestoresMembershipDefaultHome() {
        UUID otherItemId = UUID.randomUUID();
        List<CalendarRouteMemberRef> members =
                List.of(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, itemId),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, otherItemId));
        String memberSetKey = MemberSetKeys.compute(members);
        ItineraryEntity existing =
                new ItineraryEntity(
                        UUID.randomUUID(),
                        adultId,
                        LeaveByItemSource.FEED,
                        itemId,
                        CalendarRouteLeg.TO,
                        memberSetKey,
                        MemberSetKeys.membersToken(members),
                        CalendarRouteStatus.OK,
                        null,
                        20,
                        "stale",
                        "[]",
                        "[]",
                        Instant.now(),
                        Instant.now());
        existing.setHomeSideOverride(UUID.randomUUID(), null, Instant.now());
        when(itineraryRepository.findByDrivingAdultIdAndLegAndMemberSetKey(
                        adultId, CalendarRouteLeg.TO, memberSetKey))
                .thenReturn(Optional.of(existing));
        when(placeApi.findDefaultLeaveFromForMember(adultId)).thenReturn(Optional.of(locatedPlace));
        when(geocodeApi.resolveLocation("65 Elm St"))
                .thenReturn(Optional.of(new GeoPointDto(40.2, -74.2)));
        when(osrmPort.drivingDurationSeconds(40.1, -74.1, 40.2, -74.2))
                .thenReturn(Optional.of(600.0));

        CalendarRouteDto route =
                api.setCalendarRouteOrigin(
                        adultId,
                        CalendarRouteLeg.TO,
                        members,
                        LeaveByItemSource.FEED,
                        itemId,
                        "Practice",
                        List.of(),
                        "Rink",
                        "65 Elm St",
                        null,
                        null);

        assertThat(route.status()).isEqualTo(CalendarRouteStatus.OK);
        assertThat(route.stops().getFirst().name()).isEqualTo("Mom's house");
        assertThat(existing.homePlaceId()).isNull();
        assertThat(existing.homeAddress()).isNull();
    }

    @Test
    void setCalendarRouteOriginRejectsPlaceAndAddressTogether() {
        assertThatThrownBy(
                        () ->
                                api.setCalendarRouteOrigin(
                                        adultId,
                                        CalendarRouteLeg.TO,
                                        List.of(
                                                new CalendarRouteMemberRef(
                                                        LeaveByItemSource.FEED, itemId)),
                                        LeaveByItemSource.FEED,
                                        itemId,
                                        "Practice",
                                        List.of(),
                                        "Rink",
                                        "65 Elm St",
                                        placeId,
                                        "1 Main"))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(itineraryRepository, never()).save(any());
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
