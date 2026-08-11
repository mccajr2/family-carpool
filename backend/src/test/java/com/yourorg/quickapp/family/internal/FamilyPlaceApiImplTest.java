package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class FamilyPlaceApiImplTest {

    @Mock
    private FamilyMembershipApi membershipApi;

    @Mock
    private FamilyPlaceRepository places;

    @InjectMocks
    private FamilyPlaceApiImpl api;

    private final UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000001");
    private final UUID circleId = UUID.fromString("01900000-0000-7000-8000-000000000010");
    private final UUID placeId = UUID.fromString("01900000-0000-7000-8000-000000000031");

    @Test
    void findPlaceForMemberReturnsDtoWhenInCircle() {
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(places.findByIdAndCircleId(placeId, circleId))
                .thenReturn(Optional.of(place(placeId, "Mom's house", 42.0, -71.0)));

        Optional<CirclePlaceDto> result = api.findPlaceForMember(adultId, placeId);

        assertThat(result).isPresent();
        assertThat(result.get().name()).isEqualTo("Mom's house");
        assertThat(result.get().located()).isTrue();
        assertThat(result.get().circleId()).isEqualTo(circleId);
    }

    @Test
    void listLocatedPlacesForMemberSortsByNameAndSkipsUnlocated() {
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(places.findByCircleIdOrderByCreatedAtAsc(circleId))
                .thenReturn(
                        List.of(
                                place(UUID.randomUUID(), "Zebra", 1.0, 2.0),
                                place(UUID.randomUUID(), "Missing", null, null),
                                place(UUID.randomUUID(), "alpha", 3.0, 4.0)));

        List<CirclePlaceDto> result = api.listLocatedPlacesForMember(adultId);

        assertThat(result).extracting(CirclePlaceDto::name).containsExactly("alpha", "Zebra");
    }

    @Test
    void requireLocatedPlaceForMemberRejectsUnlocated() {
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(places.findByIdAndCircleId(placeId, circleId))
                .thenReturn(Optional.of(place(placeId, "Dad's house", null, null)));

        assertThatThrownBy(() -> api.requireLocatedPlaceForMember(adultId, placeId))
                .isInstanceOf(FamilyAccessException.class)
                .satisfies(
                        ex ->
                                assertThat(((FamilyAccessException) ex).status())
                                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void requireLocatedPlaceForMember404WhenMissing() {
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(places.findByIdAndCircleId(placeId, circleId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> api.requireLocatedPlaceForMember(adultId, placeId))
                .isInstanceOf(FamilyAccessException.class)
                .satisfies(
                        ex ->
                                assertThat(((FamilyAccessException) ex).status())
                                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void requireLocatedPlaceForMemberReturnsLocated() {
        when(membershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(places.findByIdAndCircleId(placeId, circleId))
                .thenReturn(Optional.of(place(placeId, "Mom's house", 42.0, -71.0)));

        CirclePlaceDto result = api.requireLocatedPlaceForMember(adultId, placeId);

        assertThat(result.id()).isEqualTo(placeId);
        assertThat(result.latitude()).isEqualTo(42.0);
    }

    private FamilyPlaceEntity place(UUID id, String name, Double lat, Double lng) {
        FamilyPlaceEntity entity =
                new FamilyPlaceEntity(
                        id,
                        circleId,
                        name,
                        name.toLowerCase(),
                        "1 Main St",
                        Instant.parse("2026-08-01T00:00:00Z"));
        entity.setCoordinates(lat, lng);
        return entity;
    }
}
