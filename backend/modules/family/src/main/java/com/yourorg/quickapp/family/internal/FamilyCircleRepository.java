package com.yourorg.quickapp.family.internal;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyCircleRepository extends JpaRepository<FamilyCircleEntity, UUID> {
    Optional<FamilyCircleEntity> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
