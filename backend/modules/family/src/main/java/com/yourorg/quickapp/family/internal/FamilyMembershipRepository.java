package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.FamilyRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyMembershipRepository extends JpaRepository<FamilyMembershipEntity, UUID> {
    Optional<FamilyMembershipEntity> findByAdultId(UUID adultId);

    Optional<FamilyMembershipEntity> findByCircleIdAndAdultId(UUID circleId, UUID adultId);

    boolean existsByAdultId(UUID adultId);

    List<FamilyMembershipEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    long countByCircleId(UUID circleId);

    long countByCircleIdAndRole(UUID circleId, FamilyRole role);
}
