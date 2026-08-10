package com.yourorg.quickapp.events.internal;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ManualEventRepository extends JpaRepository<ManualEventEntity, UUID> {
    List<ManualEventEntity> findByCircleIdOrderByStartsAtAscIdAsc(UUID circleId);

    List<ManualEventEntity>
            findByCircleIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                    UUID circleId, Instant from, Instant to);

    Optional<ManualEventEntity> findByIdAndCircleId(UUID id, UUID circleId);
}
