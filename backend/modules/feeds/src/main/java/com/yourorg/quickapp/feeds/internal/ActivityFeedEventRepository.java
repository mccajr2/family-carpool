package com.yourorg.quickapp.feeds.internal;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ActivityFeedEventRepository extends JpaRepository<ActivityFeedEventEntity, UUID> {
    /**
     * Bulk delete so Hibernate does not schedule per-row {@code EntityDeleteAction}s. Derived
     * {@code deleteBy…} loads entities and races badly with concurrent Sync now / poller.
     */
    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query("delete from ActivityFeedEventEntity e where e.feedId = :feedId")
    int deleteByFeedId(@Param("feedId") UUID feedId);

    @Modifying(clearAutomatically = false, flushAutomatically = true)
    @Query(
            "delete from ActivityFeedEventEntity e where e.feedId = :feedId and e.id not in :keepIds")
    int deleteByFeedIdAndIdNotIn(
            @Param("feedId") UUID feedId, @Param("keepIds") Collection<UUID> keepIds);

    long countByFeedId(UUID feedId);

    List<ActivityFeedEventEntity> findByFeedId(UUID feedId);

    List<ActivityFeedEventEntity>
            findByFeedIdInAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                    Collection<UUID> feedIds, Instant from, Instant to);
}
