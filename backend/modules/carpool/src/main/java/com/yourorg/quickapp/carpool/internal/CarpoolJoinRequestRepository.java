package com.yourorg.quickapp.carpool.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolJoinRequestRepository extends JpaRepository<CarpoolJoinRequestEntity, UUID> {
    Optional<CarpoolJoinRequestEntity> findBySpaceIdAndCircleId(UUID spaceId, UUID circleId);

    Optional<CarpoolJoinRequestEntity> findByIdAndSpaceId(UUID id, UUID spaceId);

    List<CarpoolJoinRequestEntity> findByCircleId(UUID circleId);

    List<CarpoolJoinRequestEntity> findBySpaceIdOrderByCreatedAtAsc(UUID spaceId);
}
