package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.CreateFamilyCircleRequest;
import com.yourorg.quickapp.family.CreateKidRequest;
import com.yourorg.quickapp.family.CreatePlaceRequest;
import com.yourorg.quickapp.family.FamilyCircleResponse;
import com.yourorg.quickapp.family.FamilyInviteResponse;
import com.yourorg.quickapp.family.FamilyMemberResponse;
import com.yourorg.quickapp.family.FamilyRole;
import com.yourorg.quickapp.family.JoinFamilyCircleRequest;
import com.yourorg.quickapp.family.KidResponse;
import com.yourorg.quickapp.family.PlaceResponse;
import com.yourorg.quickapp.family.SetDefaultLeaveFromRequest;
import com.yourorg.quickapp.family.UpdateFamilyCircleRequest;
import com.yourorg.quickapp.family.UpdateFamilyMemberRoleRequest;
import com.yourorg.quickapp.family.UpdateKidRequest;
import com.yourorg.quickapp.family.UpdatePlaceRequest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FamilyService {

    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AdultSessionApi adultSessionApi;
    private final FamilyCircleRepository circles;
    private final FamilyMembershipRepository memberships;
    private final FamilyKidRepository kids;
    private final FamilyPlaceRepository places;
    private final GeocodeService geocodeService;
    private final GarageService garageService;

    public FamilyService(
            AdultSessionApi adultSessionApi,
            FamilyCircleRepository circles,
            FamilyMembershipRepository memberships,
            FamilyKidRepository kids,
            FamilyPlaceRepository places,
            GeocodeService geocodeService,
            GarageService garageService) {
        this.adultSessionApi = adultSessionApi;
        this.circles = circles;
        this.memberships = memberships;
        this.kids = kids;
        this.places = places;
        this.geocodeService = geocodeService;
        this.garageService = garageService;
    }

    @Transactional
    public FamilyCircleResponse create(AdultResponse adult, CreateFamilyCircleRequest request) {
        if (memberships.existsByAdultId(adult.id())) {
            throw new FamilyException(HttpStatus.CONFLICT, "Adult already belongs to a family circle");
        }

        adultSessionApi.updateDisplayName(adult.id(), request.adultDisplayName());

        Instant now = Instant.now();
        String circleName = normalizeOptionalName(request.name());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(UUID.randomUUID(), circleName, generateUniqueInviteCode(), now);
        circles.save(circle);

        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circle.id(), adult.id(), FamilyRole.ORGANIZER, now);
        memberships.save(membership);

        return toResponse(circle, membership);
    }

    @Transactional(readOnly = true)
    public FamilyCircleResponse get(AdultResponse adult) {
        return loadCircle(adult.id());
    }

    @Transactional
    public FamilyCircleResponse update(AdultResponse adult, UpdateFamilyCircleRequest request) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        loaded.circle().setName(normalizeOptionalName(request.name()));
        circles.save(loaded.circle());
        return toResponse(loaded.circle(), loaded.membership());
    }

    @Transactional(readOnly = true)
    public FamilyInviteResponse getInvite(AdultResponse adult) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        return new FamilyInviteResponse(loaded.circle().inviteCode());
    }

    @Transactional
    public FamilyInviteResponse regenerateInvite(AdultResponse adult) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        loaded.circle().setInviteCode(generateUniqueInviteCode());
        circles.save(loaded.circle());
        return new FamilyInviteResponse(loaded.circle().inviteCode());
    }

    @Transactional
    public FamilyCircleResponse join(AdultResponse adult, JoinFamilyCircleRequest request) {
        if (memberships.existsByAdultId(adult.id())) {
            throw new FamilyException(HttpStatus.CONFLICT, "Adult already belongs to a family circle");
        }

        String code = normalizeInviteCode(request.code());
        FamilyCircleEntity circle =
                circles
                        .findByInviteCode(code)
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Invite code not found"));

        if (adult.displayName() == null || adult.displayName().isBlank()) {
            if (request.adultDisplayName() == null || request.adultDisplayName().isBlank()) {
                throw new FamilyException(HttpStatus.BAD_REQUEST, "adultDisplayName must not be blank");
            }
            adultSessionApi.updateDisplayName(adult.id(), request.adultDisplayName());
        }

        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(),
                        circle.id(),
                        adult.id(),
                        FamilyRole.CAREGIVER,
                        Instant.now());
        memberships.save(membership);

        return toResponse(circle, membership);
    }

    @Transactional
    public void leave(AdultResponse adult) {
        MembershipCircle loaded = requireMembership(adult.id());
        UUID circleId = loaded.circle().id();
        long memberCount = memberships.countByCircleId(circleId);
        long organizerCount = memberships.countByCircleIdAndRole(circleId, FamilyRole.ORGANIZER);
        long kidCount = kids.countByCircleId(circleId);

        if (loaded.membership().role() == FamilyRole.ORGANIZER) {
            if (organizerCount <= 1) {
                if (memberCount > 1 || kidCount > 0) {
                    throw new FamilyException(
                            HttpStatus.CONFLICT,
                            "Sole Organizer cannot leave while other members or kids remain");
                }
                garageService.removeAdult(circleId, adult.id());
                memberships.delete(loaded.membership());
                circles.delete(loaded.circle());
                return;
            }
        }

        garageService.removeAdult(circleId, adult.id());
        memberships.delete(loaded.membership());
    }

    @Transactional
    public FamilyCircleResponse updateMemberRole(
            AdultResponse adult, UUID memberAdultId, UpdateFamilyMemberRoleRequest request) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        if (adult.id().equals(memberAdultId)) {
            throw new FamilyException(HttpStatus.CONFLICT, "Cannot change your own role");
        }

        FamilyMembershipEntity member =
                memberships
                        .findByCircleIdAndAdultId(loaded.circle().id(), memberAdultId)
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Member not found"));

        FamilyRole newRole = request.role();
        if (member.role() == FamilyRole.ORGANIZER
                && newRole == FamilyRole.CAREGIVER
                && memberships.countByCircleIdAndRole(loaded.circle().id(), FamilyRole.ORGANIZER) <= 1) {
            throw new FamilyException(
                    HttpStatus.CONFLICT, "Circle must keep at least one Organizer");
        }

        member.setRole(newRole);
        memberships.save(member);
        return toResponse(loaded.circle(), loaded.membership());
    }

    @Transactional
    public void removeMember(AdultResponse adult, UUID memberAdultId) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        if (adult.id().equals(memberAdultId)) {
            throw new FamilyException(HttpStatus.CONFLICT, "Cannot remove yourself; use leave");
        }

        FamilyMembershipEntity member =
                memberships
                        .findByCircleIdAndAdultId(loaded.circle().id(), memberAdultId)
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Member not found"));

        if (member.role() == FamilyRole.ORGANIZER
                && memberships.countByCircleIdAndRole(loaded.circle().id(), FamilyRole.ORGANIZER) <= 1) {
            throw new FamilyException(
                    HttpStatus.CONFLICT, "Circle must keep at least one Organizer");
        }

        garageService.removeAdult(loaded.circle().id(), memberAdultId);
        memberships.delete(member);
    }

    @Transactional
    public KidResponse addKid(AdultResponse adult, CreateKidRequest request) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        String displayName = normalizeRequiredName(request.displayName(), "displayName");
        FamilyKidEntity kid =
                new FamilyKidEntity(
                        UUID.randomUUID(), loaded.circle().id(), displayName, Instant.now());
        kids.save(kid);
        return new KidResponse(kid.id(), kid.displayName());
    }

    @Transactional
    public KidResponse updateKid(AdultResponse adult, UUID kidId, UpdateKidRequest request) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        FamilyKidEntity kid =
                kids.findByIdAndCircleId(kidId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Kid not found"));
        kid.setDisplayName(normalizeRequiredName(request.displayName(), "displayName"));
        kids.save(kid);
        return new KidResponse(kid.id(), kid.displayName());
    }

    @Transactional
    public void deleteKid(AdultResponse adult, UUID kidId) {
        MembershipCircle loaded = requireOrganizer(adult.id());
        FamilyKidEntity kid =
                kids.findByIdAndCircleId(kidId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Kid not found"));
        kids.delete(kid);
    }

    @Transactional
    public PlaceResponse addPlace(AdultResponse adult, CreatePlaceRequest request) {
        MembershipCircle loaded = requireMembership(adult.id());
        String name = normalizeRequiredName(request.name(), "name");
        String address = normalizeRequiredAddress(request.address());
        String nameNormalized = normalizePlaceNameKey(name);
        assertPlaceNameAvailable(loaded.circle().id(), nameNormalized, null);
        FamilyPlaceEntity place =
                new FamilyPlaceEntity(
                        UUID.randomUUID(),
                        loaded.circle().id(),
                        name,
                        nameNormalized,
                        address,
                        Instant.now());
        applyGeocode(place, address);
        places.save(place);
        return toPlaceResponse(place);
    }

    @Transactional
    public PlaceResponse updatePlace(AdultResponse adult, UUID placeId, UpdatePlaceRequest request) {
        MembershipCircle loaded = requireMembership(adult.id());
        FamilyPlaceEntity place =
                places.findByIdAndCircleId(placeId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Place not found"));
        String name = normalizeRequiredName(request.name(), "name");
        String address = normalizeRequiredAddress(request.address());
        String nameNormalized = normalizePlaceNameKey(name);
        assertPlaceNameAvailable(loaded.circle().id(), nameNormalized, place.id());
        boolean addressChanged =
                !GeocodeService.normalizeAddress(place.address())
                        .equals(GeocodeService.normalizeAddress(address));
        place.setName(name, nameNormalized);
        place.setAddress(address);
        if (addressChanged || place.latitude() == null || place.longitude() == null) {
            applyGeocode(place, address);
        }
        places.save(place);
        return toPlaceResponse(place);
    }

    @Transactional
    public PlaceResponse locatePlace(AdultResponse adult, UUID placeId) {
        MembershipCircle loaded = requireMembership(adult.id());
        FamilyPlaceEntity place =
                places.findByIdAndCircleId(placeId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Place not found"));
        applyGeocode(place, place.address());
        places.save(place);
        return toPlaceResponse(place);
    }

    @Transactional
    public void deletePlace(AdultResponse adult, UUID placeId) {
        MembershipCircle loaded = requireMembership(adult.id());
        FamilyPlaceEntity place =
                places.findByIdAndCircleId(placeId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Place not found"));
        places.delete(place);
    }

    @Transactional
    public FamilyCircleResponse setDefaultLeaveFrom(
            AdultResponse adult, SetDefaultLeaveFromRequest request) {
        MembershipCircle loaded = requireMembership(adult.id());
        UUID placeId = request == null ? null : request.placeId();
        if (placeId == null) {
            loaded.membership().setDefaultLeaveFromPlaceId(null);
            memberships.save(loaded.membership());
            return toResponse(loaded.circle(), loaded.membership());
        }
        FamilyPlaceEntity place =
                places.findByIdAndCircleId(placeId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Place not found"));
        if (place.latitude() == null || place.longitude() == null) {
            throw new FamilyException(
                    HttpStatus.BAD_REQUEST, "Place is not located; retry locate or pick another");
        }
        loaded.membership().setDefaultLeaveFromPlaceId(place.id());
        memberships.save(loaded.membership());
        return toResponse(loaded.circle(), loaded.membership());
    }

    private FamilyCircleResponse loadCircle(UUID adultId) {
        MembershipCircle loaded = requireMembership(adultId);
        return toResponse(loaded.circle(), loaded.membership());
    }

    private MembershipCircle requireOrganizer(UUID adultId) {
        MembershipCircle loaded = requireMembership(adultId);
        if (loaded.membership().role() != FamilyRole.ORGANIZER) {
            throw new FamilyException(HttpStatus.FORBIDDEN, "Organizer role required");
        }
        return loaded;
    }

    private MembershipCircle requireMembership(UUID adultId) {
        FamilyMembershipEntity membership =
                memberships
                        .findByAdultId(adultId)
                        .orElseThrow(
                                () -> new FamilyException(HttpStatus.NOT_FOUND, "Family circle not found"));
        FamilyCircleEntity circle =
                circles
                        .findById(membership.circleId())
                        .orElseThrow(
                                () -> new FamilyException(HttpStatus.NOT_FOUND, "Family circle not found"));
        return new MembershipCircle(membership, circle);
    }

    private FamilyCircleResponse toResponse(
            FamilyCircleEntity circle, FamilyMembershipEntity callerMembership) {
        UUID defaultPlaceId = callerMembership.defaultLeaveFromPlaceId();
        String defaultPlaceName = null;
        if (defaultPlaceId != null) {
            defaultPlaceName =
                    places.findByIdAndCircleId(defaultPlaceId, circle.id())
                            .map(FamilyPlaceEntity::name)
                            .orElse(null);
            if (defaultPlaceName == null) {
                defaultPlaceId = null;
            }
        }
        return new FamilyCircleResponse(
                circle.id(),
                circle.name(),
                callerMembership.role(),
                membersFor(circle.id()),
                kidsFor(circle.id()),
                placesFor(circle.id()),
                defaultPlaceId,
                defaultPlaceName);
    }

    private List<FamilyMemberResponse> membersFor(UUID circleId) {
        return memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(
                        membership -> {
                            AdultResponse member = adultSessionApi.requireAdult(membership.adultId());
                            return new FamilyMemberResponse(
                                    member.id(), member.email(), member.displayName(), membership.role());
                        })
                .toList();
    }

    private List<KidResponse> kidsFor(UUID circleId) {
        return kids.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(kid -> new KidResponse(kid.id(), kid.displayName()))
                .toList();
    }

    private List<PlaceResponse> placesFor(UUID circleId) {
        return places.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(this::toPlaceResponse)
                .toList();
    }

    private void applyGeocode(FamilyPlaceEntity place, String address) {
        geocodeService
                .resolve(address)
                .ifPresentOrElse(
                        coords -> place.setCoordinates(coords.latitude(), coords.longitude()),
                        () -> place.setCoordinates(null, null));
    }

    private PlaceResponse toPlaceResponse(FamilyPlaceEntity place) {
        return new PlaceResponse(
                place.id(), place.name(), place.address(), place.latitude(), place.longitude());
    }

    private void assertPlaceNameAvailable(UUID circleId, String nameNormalized, UUID excludePlaceId) {
        boolean taken =
                excludePlaceId == null
                        ? places.existsByCircleIdAndNameNormalized(circleId, nameNormalized)
                        : places.existsByCircleIdAndNameNormalizedAndIdNot(
                                circleId, nameNormalized, excludePlaceId);
        if (taken) {
            throw new FamilyException(HttpStatus.CONFLICT, "Place name already exists in this circle");
        }
    }

    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < 32; attempt++) {
            String code = randomInviteCode();
            if (!circles.existsByInviteCode(code)) {
                return code;
            }
        }
        throw new FamilyException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate invite code");
    }

    private static String randomInviteCode() {
        StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            builder.append(INVITE_ALPHABET.charAt(RANDOM.nextInt(INVITE_ALPHABET.length())));
        }
        return builder.toString();
    }

    private static String normalizeInviteCode(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "code must not be blank");
        }
        String normalized = raw.trim().toUpperCase();
        if (normalized.length() > 16) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "code is too long");
        }
        return normalized;
    }

    private static String normalizeOptionalName(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "name must not be blank");
        }
        if (trimmed.length() > 80) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "name is too long");
        }
        return trimmed;
    }

    private static String normalizeRequiredName(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, field + " must not be blank");
        }
        String trimmed = raw.trim();
        if (trimmed.length() > 80) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, field + " is too long");
        }
        return trimmed;
    }

    private static String normalizeRequiredAddress(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "address must not be blank");
        }
        String trimmed = raw.trim();
        if (trimmed.length() > 255) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "address is too long");
        }
        return trimmed;
    }

    private static String normalizePlaceNameKey(String trimmedName) {
        return trimmedName.toLowerCase(Locale.ROOT);
    }

    private record MembershipCircle(FamilyMembershipEntity membership, FamilyCircleEntity circle) {}
}
