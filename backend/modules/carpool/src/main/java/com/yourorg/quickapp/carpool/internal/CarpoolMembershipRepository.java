package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolMembershipRepository extends JpaRepository<CarpoolMembershipEntity, UUID> {
    Optional<CarpoolMembershipEntity> findBySpaceIdAndCircleId(UUID spaceId, UUID circleId);

    List<CarpoolMembershipEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    List<CarpoolMembershipEntity> findBySpaceIdOrderByCreatedAtAsc(UUID spaceId);

    List<CarpoolMembershipEntity> findBySpaceIdIn(Collection<UUID> spaceIds);

    long countBySpaceId(UUID spaceId);
}
