package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
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
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByStatus;
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
                        osrmPort,
                        properties);
        lenient()
                .when(placeApi.findDefaultLeaveFromForMember(any()))
                .thenReturn(Optional.empty());
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
}
