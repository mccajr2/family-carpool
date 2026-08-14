package com.yourorg.quickapp.family.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyVehicleRepository extends JpaRepository<FamilyVehicleEntity, UUID> {
    List<FamilyVehicleEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    Optional<FamilyVehicleEntity> findByIdAndCircleId(UUID id, UUID circleId);

    boolean existsByCircleIdAndOwnerAdultIdAndLabelNormalized(
            UUID circleId, UUID ownerAdultId, String labelNormalized);

    boolean existsByCircleIdAndOwnerAdultIdAndLabelNormalizedAndIdNot(
            UUID circleId, UUID ownerAdultId, String labelNormalized, UUID id);

    List<FamilyVehicleEntity> findByCircleIdAndOwnerAdultId(UUID circleId, UUID ownerAdultId);
}
