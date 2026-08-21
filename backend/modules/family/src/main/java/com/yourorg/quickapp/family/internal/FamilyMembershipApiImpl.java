package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyRole;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
class FamilyMembershipApiImpl implements FamilyMembershipApi {

    private final FamilyMembershipRepository memberships;
    private final FamilyCircleRepository circles;
    private final FamilyKidRepository kids;

    FamilyMembershipApiImpl(
            FamilyMembershipRepository memberships,
            FamilyCircleRepository circles,
            FamilyKidRepository kids) {
        this.memberships = memberships;
        this.circles = circles;
        this.kids = kids;
    }

    @Override
    public UUID requireOrganizerCircleId(UUID adultId) {
        FamilyMembershipEntity membership = requireMembership(adultId);
        if (membership.role() != FamilyRole.ORGANIZER) {
            throw new FamilyAccessException(HttpStatus.FORBIDDEN, "Organizer role required");
        }
        return membership.circleId();
    }

    @Override
    public UUID requireMemberCircleId(UUID adultId) {
        return requireMembership(adultId).circleId();
    }

    @Override
    public FamilyRole requireMemberRole(UUID adultId) {
        return requireMembership(adultId).role();
    }

    @Override
    public void requireKidsInCircle(UUID circleId, Collection<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            return;
        }
        Set<UUID> unique = new HashSet<>(kidIds);
        for (UUID kidId : unique) {
            if (kids.findByIdAndCircleId(kidId, circleId).isEmpty()) {
                throw new FamilyAccessException(HttpStatus.BAD_REQUEST, "Kid not found in this circle");
            }
        }
    }

    @Override
    public void requireAdultInCircle(UUID circleId, UUID adultId) {
        if (memberships.findByCircleIdAndAdultId(circleId, adultId).isEmpty()) {
            throw new FamilyAccessException(HttpStatus.NOT_FOUND, "Adult is not a member of this circle");
        }
    }

    @Override
    public Optional<FamilyCircleName> findCircle(UUID circleId) {
        if (circleId == null) {
            return Optional.empty();
        }
        return circles.findById(circleId).map(FamilyMembershipApiImpl::toName);
    }

    @Override
    public List<FamilyCircleName> findCircles(Collection<UUID> circleIds) {
        if (circleIds == null || circleIds.isEmpty()) {
            return List.of();
        }
        List<UUID> unique =
                circleIds.stream().filter(Objects::nonNull).distinct().toList();
        if (unique.isEmpty()) {
            return List.of();
        }
        Map<UUID, FamilyCircleEntity> byId =
                circles.findAllById(unique).stream()
                        .collect(Collectors.toMap(FamilyCircleEntity::id, Function.identity()));
        return unique.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(FamilyMembershipApiImpl::toName)
                .toList();
    }

    @Override
    public List<FamilyKidName> findKids(UUID circleId, Collection<UUID> kidIds) {
        if (circleId == null || kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        List<UUID> unique =
                kidIds.stream().filter(Objects::nonNull).distinct().toList();
        if (unique.isEmpty()) {
            return List.of();
        }
        Map<UUID, FamilyKidEntity> byId =
                kids.findAllById(unique).stream()
                        .filter(kid -> circleId.equals(kid.circleId()))
                        .collect(Collectors.toMap(FamilyKidEntity::id, Function.identity()));
        return unique.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(kid -> new FamilyKidName(kid.id(), kid.displayName()))
                .toList();
    }

    private FamilyMembershipEntity requireMembership(UUID adultId) {
        FamilyMembershipEntity membership =
                memberships
                        .findByAdultId(adultId)
                        .orElseThrow(
                                () ->
                                        new FamilyAccessException(
                                                HttpStatus.NOT_FOUND, "Family circle not found"));
        circles
                .findById(membership.circleId())
                .orElseThrow(
                        () ->
                                new FamilyAccessException(
                                        HttpStatus.NOT_FOUND, "Family circle not found"));
        return membership;
    }

    private static FamilyCircleName toName(FamilyCircleEntity circle) {
        return new FamilyCircleName(circle.id(), circle.name());
    }
}
