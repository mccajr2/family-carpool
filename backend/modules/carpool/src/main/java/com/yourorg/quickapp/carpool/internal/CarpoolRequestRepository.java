package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolRequestRepository extends JpaRepository<CarpoolRequestEntity, UUID> {

    Optional<CarpoolRequestEntity> findByIdAndSpaceId(UUID id, UUID spaceId);

    boolean existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
            UUID spaceId, String eventKey, UUID kidId, UUID requestingCircleId);

    List<CarpoolRequestEntity> findBySpaceIdAndEventKeyIn(UUID spaceId, Collection<String> eventKeys);
}
