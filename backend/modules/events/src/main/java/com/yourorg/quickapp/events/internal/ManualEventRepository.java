package com.yourorg.quickapp.events.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ManualEventRepository extends JpaRepository<ManualEventEntity, UUID> {
    List<ManualEventEntity> findByCircleIdOrderByStartsAtAscIdAsc(UUID circleId);

    Optional<ManualEventEntity> findByIdAndCircleId(UUID id, UUID circleId);
}
