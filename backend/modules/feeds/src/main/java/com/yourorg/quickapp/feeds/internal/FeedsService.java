package com.yourorg.quickapp.feeds.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.CreateFeedRequest;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.UpdateFeedRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeedsService {

    private final FamilyMembershipApi familyMembershipApi;
    private final ActivityFeedRepository feeds;
    private final ActivityFeedEventRepository events;
    private final IcalFetchPort icalFetchPort;
    private final IcalParser icalParser;

    public FeedsService(
            FamilyMembershipApi familyMembershipApi,
            ActivityFeedRepository feeds,
            ActivityFeedEventRepository events,
            IcalFetchPort icalFetchPort,
            IcalParser icalParser) {
        this.familyMembershipApi = familyMembershipApi;
        this.feeds = feeds;
        this.events = events;
        this.icalFetchPort = icalFetchPort;
        this.icalParser = icalParser;
    }

    @Transactional(readOnly = true)
    public List<FeedResponse> list(AdultResponse adult) {
        UUID circleId = familyMembershipApi.requireOrganizerCircleId(adult.id());
        return feeds.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FeedResponse create(AdultResponse adult, CreateFeedRequest request) {
        UUID circleId = familyMembershipApi.requireOrganizerCircleId(adult.id());
        String name = normalizeRequired(request.name(), "name");
        String sourceUrl = normalizeSourceUrl(request.sourceUrl());
        Set<UUID> kidIds = normalizeKidIds(request.kidIds());
        familyMembershipApi.requireKidsInCircle(circleId, kidIds);
        if (feeds.existsByCircleIdAndSourceUrl(circleId, sourceUrl)) {
            throw new FeedsException(HttpStatus.CONFLICT, "Feed URL already exists in this circle");
        }
        ActivityFeedEntity feed =
                new ActivityFeedEntity(UUID.randomUUID(), circleId, name, sourceUrl, Instant.now());
        feed.setKidIds(kidIds);
        feeds.save(feed);
        syncFeed(feed);
        feeds.save(feed);
        return toResponse(feed);
    }

    @Transactional
    public FeedResponse update(AdultResponse adult, UUID feedId, UpdateFeedRequest request) {
        UUID circleId = familyMembershipApi.requireOrganizerCircleId(adult.id());
        ActivityFeedEntity feed =
                feeds.findByIdAndCircleIdForUpdate(feedId, circleId)
                        .orElseThrow(() -> new FeedsException(HttpStatus.NOT_FOUND, "Feed not found"));
        String name = normalizeRequired(request.name(), "name");
        String sourceUrl = normalizeSourceUrl(request.sourceUrl());
        Set<UUID> kidIds = normalizeKidIds(request.kidIds());
        familyMembershipApi.requireKidsInCircle(circleId, kidIds);
        if (feeds.existsByCircleIdAndSourceUrlAndIdNot(circleId, sourceUrl, feed.id())) {
            throw new FeedsException(HttpStatus.CONFLICT, "Feed URL already exists in this circle");
        }
        boolean urlChanged = !feed.sourceUrl().equals(sourceUrl);
        feed.setName(name);
        feed.setSourceUrl(sourceUrl);
        feed.setKidIds(kidIds);
        if (urlChanged) {
            syncFeed(feed);
        }
        feeds.save(feed);
        return toResponse(feed);
    }

    @Transactional
    public FeedResponse sync(AdultResponse adult, UUID feedId) {
        UUID circleId = familyMembershipApi.requireOrganizerCircleId(adult.id());
        ActivityFeedEntity feed =
                feeds.findByIdAndCircleIdForUpdate(feedId, circleId)
                        .orElseThrow(() -> new FeedsException(HttpStatus.NOT_FOUND, "Feed not found"));
        syncFeed(feed);
        feeds.save(feed);
        return toResponse(feed);
    }

    @Transactional
    public void delete(AdultResponse adult, UUID feedId) {
        UUID circleId = familyMembershipApi.requireOrganizerCircleId(adult.id());
        ActivityFeedEntity feed =
                feeds.findByIdAndCircleId(feedId, circleId)
                        .orElseThrow(() -> new FeedsException(HttpStatus.NOT_FOUND, "Feed not found"));
        events.deleteByFeedId(feed.id());
        feeds.delete(feed);
    }

    /**
     * Background / test entry: sync every feed using the same path as Sync now.
     *
     * @return number of feeds attempted
     */
    @Transactional
    public int pollAllFeeds() {
        List<UUID> ids =
                feeds.findAllByOrderByCreatedAtAsc().stream().map(ActivityFeedEntity::id).toList();
        for (UUID id : ids) {
            pollFeed(id);
        }
        return ids.size();
    }

    /** Sync a single feed by id (used by the scheduled poller between delays). */
    @Transactional
    public void pollFeed(UUID feedId) {
        ActivityFeedEntity feed = feeds.findByIdForUpdate(feedId).orElse(null);
        if (feed == null) {
            return;
        }
        syncFeed(feed);
        feeds.save(feed);
    }

    static String normalizeSourceUrl(String raw) {
        String trimmed = normalizeRequired(raw, "sourceUrl");
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("webcal://")) {
            return "https://" + trimmed.substring("webcal://".length());
        }
        if (!(lower.startsWith("https://") || lower.startsWith("http://"))) {
            throw new FeedsException(HttpStatus.BAD_REQUEST, "sourceUrl must be http(s) or webcal");
        }
        return trimmed;
    }

    private void syncFeed(ActivityFeedEntity feed) {
        final String body;
        final List<ParsedIcalEvent> parsed;
        try {
            body = icalFetchPort.fetch(feed.sourceUrl());
            parsed = icalParser.parse(body);
        } catch (Exception ex) {
            // Soft-fail only fetch/parse — never swallow persistence errors (stale deletes leave
            // a dirty session and blow up later on countByFeedId).
            feed.markSyncFailure(ex.getMessage() == null ? ex.toString() : ex.getMessage());
            return;
        }
        events.deleteByFeedId(feed.id());
        List<ActivityFeedEventEntity> rows = new ArrayList<>();
        Set<String> seenUids = new HashSet<>();
        for (ParsedIcalEvent event : parsed) {
            String uid = event.uid();
            if (uid != null) {
                if (!seenUids.add(uid)) {
                    continue;
                }
            }
            rows.add(
                    new ActivityFeedEventEntity(
                            UUID.randomUUID(),
                            feed.id(),
                            uid,
                            event.summary(),
                            event.startsAt(),
                            event.endsAt(),
                            event.location()));
        }
        events.saveAll(rows);
        feed.markSyncSuccess(Instant.now());
    }

    private FeedResponse toResponse(ActivityFeedEntity feed) {
        return new FeedResponse(
                feed.id(),
                feed.name(),
                feed.sourceUrl(),
                List.copyOf(feed.kidIds()),
                feed.lastSyncedAt(),
                feed.lastSyncError(),
                (int) events.countByFeedId(feed.id()));
    }

    private static Set<UUID> normalizeKidIds(List<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(kidIds);
    }

    private static String normalizeRequired(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new FeedsException(HttpStatus.BAD_REQUEST, field + " must not be blank");
        }
        return value.trim();
    }
}
