package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
class FamilyPlaceApiImpl implements FamilyPlaceApi {

    private final FamilyMembershipApi membershipApi;
    private final FamilyPlaceRepository places;

    FamilyPlaceApiImpl(FamilyMembershipApi membershipApi, FamilyPlaceRepository places) {
        this.membershipApi = membershipApi;
        this.places = places;
    }

    @Override
    public Optional<CirclePlaceDto> findPlaceForMember(UUID adultId, UUID placeId) {
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        return places.findByIdAndCircleId(placeId, circleId).map(FamilyPlaceApiImpl::toDto);
    }

    @Override
    public List<CirclePlaceDto> listLocatedPlacesForMember(UUID adultId) {
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        return places.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(FamilyPlaceApiImpl::toDto)
                .filter(CirclePlaceDto::located)
                .sorted(Comparator.comparing(p -> p.name().toLowerCase(Locale.ROOT)))
                .toList();
    }

    @Override
    public CirclePlaceDto requireLocatedPlaceForMember(UUID adultId, UUID placeId) {
        CirclePlaceDto place =
                findPlaceForMember(adultId, placeId)
                        .orElseThrow(
                                () ->
                                        new FamilyAccessException(
                                                HttpStatus.NOT_FOUND, "Place not found"));
        if (!place.located()) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "Place is not located; retry locate or pick another");
        }
        return place;
    }

    private static CirclePlaceDto toDto(FamilyPlaceEntity entity) {
        return new CirclePlaceDto(
                entity.id(),
                entity.circleId(),
                entity.name(),
                entity.address(),
                entity.latitude(),
                entity.longitude());
    }
}
