package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyRole;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
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
        if (membership.role() != FamilyRole.ORGANIZER) {
            throw new FamilyAccessException(HttpStatus.FORBIDDEN, "Organizer role required");
        }
        return membership.circleId();
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
}
