package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.CreateFamilyCircleRequest;
import com.yourorg.quickapp.family.CreateKidRequest;
import com.yourorg.quickapp.family.FamilyCircleResponse;
import com.yourorg.quickapp.family.FamilyRole;
import com.yourorg.quickapp.family.KidResponse;
import com.yourorg.quickapp.family.UpdateFamilyCircleRequest;
import com.yourorg.quickapp.family.UpdateKidRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FamilyService {

    private final AdultSessionApi adultSessionApi;
    private final FamilyCircleRepository circles;
    private final FamilyMembershipRepository memberships;
    private final FamilyKidRepository kids;

    public FamilyService(
            AdultSessionApi adultSessionApi,
            FamilyCircleRepository circles,
            FamilyMembershipRepository memberships,
            FamilyKidRepository kids) {
        this.adultSessionApi = adultSessionApi;
        this.circles = circles;
        this.memberships = memberships;
        this.kids = kids;
    }

    @Transactional
    public FamilyCircleResponse create(AdultResponse adult, CreateFamilyCircleRequest request) {
        if (memberships.existsByAdultId(adult.id())) {
            throw new FamilyException(HttpStatus.CONFLICT, "Adult already belongs to a family circle");
        }

        adultSessionApi.updateDisplayName(adult.id(), request.adultDisplayName());

        Instant now = Instant.now();
        String circleName = normalizeOptionalName(request.name());
        FamilyCircleEntity circle = new FamilyCircleEntity(UUID.randomUUID(), circleName, now);
        circles.save(circle);

        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circle.id(), adult.id(), FamilyRole.ORGANIZER, now);
        memberships.save(membership);

        return toResponse(circle, membership.role(), List.of());
    }

    @Transactional(readOnly = true)
    public FamilyCircleResponse get(AdultResponse adult) {
        return loadCircle(adult.id());
    }

    @Transactional
    public FamilyCircleResponse update(AdultResponse adult, UpdateFamilyCircleRequest request) {
        MembershipCircle loaded = requireMembership(adult.id());
        loaded.circle().setName(normalizeOptionalName(request.name()));
        circles.save(loaded.circle());
        return toResponse(loaded.circle(), loaded.membership().role(), kidsFor(loaded.circle().id()));
    }

    @Transactional
    public KidResponse addKid(AdultResponse adult, CreateKidRequest request) {
        MembershipCircle loaded = requireMembership(adult.id());
        String displayName = normalizeRequiredName(request.displayName(), "displayName");
        FamilyKidEntity kid =
                new FamilyKidEntity(
                        UUID.randomUUID(), loaded.circle().id(), displayName, Instant.now());
        kids.save(kid);
        return new KidResponse(kid.id(), kid.displayName());
    }

    @Transactional
    public KidResponse updateKid(AdultResponse adult, UUID kidId, UpdateKidRequest request) {
        MembershipCircle loaded = requireMembership(adult.id());
        FamilyKidEntity kid =
                kids.findByIdAndCircleId(kidId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Kid not found"));
        kid.setDisplayName(normalizeRequiredName(request.displayName(), "displayName"));
        kids.save(kid);
        return new KidResponse(kid.id(), kid.displayName());
    }

    @Transactional
    public void deleteKid(AdultResponse adult, UUID kidId) {
        MembershipCircle loaded = requireMembership(adult.id());
        FamilyKidEntity kid =
                kids.findByIdAndCircleId(kidId, loaded.circle().id())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Kid not found"));
        kids.delete(kid);
    }

    private FamilyCircleResponse loadCircle(UUID adultId) {
        MembershipCircle loaded = requireMembership(adultId);
        return toResponse(loaded.circle(), loaded.membership().role(), kidsFor(loaded.circle().id()));
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

    private List<KidResponse> kidsFor(UUID circleId) {
        return kids.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(kid -> new KidResponse(kid.id(), kid.displayName()))
                .toList();
    }

    private static FamilyCircleResponse toResponse(
            FamilyCircleEntity circle, FamilyRole role, List<KidResponse> kids) {
        return new FamilyCircleResponse(circle.id(), circle.name(), role, kids);
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

    private record MembershipCircle(FamilyMembershipEntity membership, FamilyCircleEntity circle) {}
}
