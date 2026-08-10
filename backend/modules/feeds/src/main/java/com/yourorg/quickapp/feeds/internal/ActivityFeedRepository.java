package com.yourorg.quickapp.feeds.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityFeedRepository extends JpaRepository<ActivityFeedEntity, UUID> {
    List<ActivityFeedEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    List<ActivityFeedEntity> findAllByOrderByCreatedAtAsc();

    Optional<ActivityFeedEntity> findByIdAndCircleId(UUID id, UUID circleId);

    boolean existsByCircleIdAndSourceUrl(UUID circleId, String sourceUrl);

    boolean existsByCircleIdAndSourceUrlAndIdNot(UUID circleId, String sourceUrl, UUID id);
}
