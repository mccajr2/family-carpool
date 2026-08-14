package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolSpaceRepository extends JpaRepository<CarpoolSpaceEntity, UUID> {
    Optional<CarpoolSpaceEntity> findByNormalizedSourceUrl(String normalizedSourceUrl);

    List<CarpoolSpaceEntity> findByNormalizedSourceUrlIn(Collection<String> urls);

    Optional<CarpoolSpaceEntity> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
