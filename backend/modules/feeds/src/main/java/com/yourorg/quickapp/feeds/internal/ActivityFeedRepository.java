package com.yourorg.quickapp.feeds.internal;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ActivityFeedRepository extends JpaRepository<ActivityFeedEntity, UUID> {
    List<ActivityFeedEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    List<ActivityFeedEntity> findAllByOrderByCreatedAtAsc();

    Optional<ActivityFeedEntity> findByIdAndCircleId(UUID id, UUID circleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from ActivityFeedEntity f where f.id = :id and f.circleId = :circleId")
    Optional<ActivityFeedEntity> findByIdAndCircleIdForUpdate(
            @Param("id") UUID id, @Param("circleId") UUID circleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from ActivityFeedEntity f where f.id = :id")
    Optional<ActivityFeedEntity> findByIdForUpdate(@Param("id") UUID id);

    boolean existsByCircleIdAndSourceUrl(UUID circleId, String sourceUrl);

    boolean existsByCircleIdAndSourceUrlAndIdNot(UUID circleId, String sourceUrl, UUID id);
}
