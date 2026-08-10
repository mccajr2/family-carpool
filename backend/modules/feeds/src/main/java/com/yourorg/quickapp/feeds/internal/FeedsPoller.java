package com.yourorg.quickapp.feeds.internal;

import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically re-syncs every activity feed using {@link FeedsService}'s Sync now path.
 *
 * <p>Assumes a single app instance (v1). Disable in CI via {@code app.feeds.poll-enabled=false}.
 */
@Component
@ConditionalOnProperty(name = "app.feeds.poll-enabled", havingValue = "true", matchIfMissing = true)
class FeedsPoller {

    private static final Logger log = LoggerFactory.getLogger(FeedsPoller.class);

    private final FeedsService feedsService;
    private final ActivityFeedRepository feeds;
    private final long interFeedDelayMs;

    FeedsPoller(
            FeedsService feedsService,
            ActivityFeedRepository feeds,
            @Value("${app.feeds.poll-inter-feed-delay-ms:250}") long interFeedDelayMs) {
        this.feedsService = feedsService;
        this.feeds = feeds;
        this.interFeedDelayMs = Math.max(0L, interFeedDelayMs);
    }

    @Scheduled(
            fixedDelayString = "${app.feeds.poll-interval-ms:1800000}",
            initialDelayString = "${app.feeds.poll-initial-delay-ms:60000}")
    void pollAllFeeds() {
        List<UUID> ids =
                feeds.findAllByOrderByCreatedAtAsc().stream().map(ActivityFeedEntity::id).toList();
        if (ids.isEmpty()) {
            return;
        }
        log.info("Activity feed poll starting for {} feed(s)", ids.size());
        int index = 0;
        for (UUID id : ids) {
            try {
                feedsService.pollFeed(id);
            } catch (Exception ex) {
                log.warn("Activity feed poll failed for {}: {}", id, ex.toString());
            }
            index++;
            if (index < ids.size() && interFeedDelayMs > 0L) {
                try {
                    Thread.sleep(interFeedDelayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("Activity feed poll interrupted");
                    return;
                }
            }
        }
        log.info("Activity feed poll finished for {} feed(s)", ids.size());
    }
}
