package com.yourorg.quickapp.family.internal;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyMembershipRepository extends JpaRepository<FamilyMembershipEntity, UUID> {
    Optional<FamilyMembershipEntity> findByAdultId(UUID adultId);

    boolean existsByAdultId(UUID adultId);
}
