package com.yourorg.quickapp.feeds.internal;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityFeedEventRepository extends JpaRepository<ActivityFeedEventEntity, UUID> {
    void deleteByFeedId(UUID feedId);

    long countByFeedId(UUID feedId);
}
