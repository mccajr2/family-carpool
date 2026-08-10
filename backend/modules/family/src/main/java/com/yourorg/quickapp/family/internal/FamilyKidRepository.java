package com.yourorg.quickapp.family.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyKidRepository extends JpaRepository<FamilyKidEntity, UUID> {
    List<FamilyKidEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    Optional<FamilyKidEntity> findByIdAndCircleId(UUID id, UUID circleId);

    long countByCircleId(UUID circleId);
}
