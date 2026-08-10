package com.yourorg.quickapp.family.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyPlaceRepository extends JpaRepository<FamilyPlaceEntity, UUID> {
    List<FamilyPlaceEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    Optional<FamilyPlaceEntity> findByIdAndCircleId(UUID id, UUID circleId);

    boolean existsByCircleIdAndNameNormalized(UUID circleId, String nameNormalized);

    boolean existsByCircleIdAndNameNormalizedAndIdNot(
            UUID circleId, String nameNormalized, UUID id);
}
