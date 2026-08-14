package com.yourorg.quickapp.feeds;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Public feeds surface for other Modulith modules (e.g. carpool). List/find/ensure
 * are circle-scoped and do not require Organizer — HTTP create/update/delete/sync
 * stay Organizer-only.
 */
public interface FeedsApi {

    /** Feeds for the circle, oldest first. Empty when the circle has none. */
    List<FeedResponse> listByCircle(UUID circleId);

    /**
     * Find a feed in the circle by source URL after the same normalize as HTTP
     * create ({@code trim}; {@code webcal://} → {@code https://}).
     */
    Optional<FeedResponse> findByCircleAndNormalizedUrl(UUID circleId, String sourceUrl);

    /**
     * Create-if-absent for {@code (circleId, normalized sourceUrl)}. When missing,
     * creates a feed named {@code name} with zero kid links and runs the same
     * auto-sync path as Organizer create. When present, returns the existing feed
     * (no second row, no duplicate-URL 409, no re-sync).
     */
    FeedResponse ensureFeed(UUID circleId, String sourceUrl, String name);
}
