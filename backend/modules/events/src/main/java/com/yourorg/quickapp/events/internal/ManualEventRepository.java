package com.yourorg.quickapp.events.internal;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ManualEventRepository extends JpaRepository<ManualEventEntity, UUID> {
    List<ManualEventEntity> findByCircleIdOrderByStartsAtAscIdAsc(UUID circleId);

    List<ManualEventEntity>
            findByCircleIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                    UUID circleId, Instant from, Instant to);

    @Query(
            """
            select e from ManualEventEntity e
            where e.circleId = :circleId
              and e.startsAt < :windowEnd
              and coalesce(e.endsAt, e.startsAt) > :windowStart
            order by e.startsAt asc, e.id asc
            """)
    List<ManualEventEntity> findOverlapping(
            @Param("circleId") UUID circleId,
            @Param("windowStart") Instant windowStart,
            @Param("windowEnd") Instant windowEnd);

    Optional<ManualEventEntity> findByIdAndCircleId(UUID id, UUID circleId);
}
