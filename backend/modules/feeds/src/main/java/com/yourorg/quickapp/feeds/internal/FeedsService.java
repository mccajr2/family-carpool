package com.yourorg.quickapp.feeds.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.CreateFeedRequest;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import com.yourorg.quickapp.feeds.UpdateFeedRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeedsService implements FeedsApi {

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
        return listByCircle(circleId);
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
        return persistAndSync(circleId, name, sourceUrl, kidIds);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FeedResponse> listByCircle(UUID circleId) {
        return feeds.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FeedResponse> findByCircleAndNormalizedUrl(UUID circleId, String sourceUrl) {
        String normalized = normalizeSourceUrl(sourceUrl);
        return feeds.findByCircleIdAndSourceUrl(circleId, normalized).map(this::toResponse);
    }

    @Override
    @Transactional
    public FeedResponse ensureFeed(UUID circleId, String sourceUrl, String name) {
        String normalizedName = normalizeRequired(name, "name");
        String normalizedUrl = normalizeSourceUrl(sourceUrl);
        Optional<ActivityFeedEntity> existing =
                feeds.findByCircleIdAndSourceUrl(circleId, normalizedUrl);
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }
        return persistAndSync(circleId, normalizedName, normalizedUrl, Set.of());
    }

    private FeedResponse persistAndSync(
            UUID circleId, String name, String sourceUrl, Set<UUID> kidIds) {
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

        // Upsert by iCal UID so calendar / coverage / leave-from item ids stay stable across
        // Sync now and the background poller. Delete-all + recreate broke Assign (404) on FEED
        // rows the client still had loaded.
        List<ActivityFeedEventEntity> existing = events.findByFeedId(feed.id());
        Map<String, ActivityFeedEventEntity> byUid = new HashMap<>();
        List<ActivityFeedEventEntity> withoutUid = new ArrayList<>();
        for (ActivityFeedEventEntity row : existing) {
            if (row.uid() != null) {
                byUid.putIfAbsent(row.uid(), row);
            } else {
                withoutUid.add(row);
            }
        }

        List<ActivityFeedEventEntity> upserts = new ArrayList<>();
        Set<UUID> keepIds = new HashSet<>();
        Set<String> seenUids = new HashSet<>();
        for (ParsedIcalEvent event : parsed) {
            String uid = event.uid();
            if (uid != null) {
                if (!seenUids.add(uid)) {
                    continue;
                }
                ActivityFeedEventEntity row = byUid.remove(uid);
                if (row == null) {
                    row =
                            new ActivityFeedEventEntity(
                                    UUID.randomUUID(),
                                    feed.id(),
                                    uid,
                                    event.summary(),
                                    event.startsAt(),
                                    event.endsAt(),
                                    event.location());
                } else {
                    row.applySnapshot(
                            event.summary(), event.startsAt(), event.endsAt(), event.location());
                }
                keepIds.add(row.id());
                upserts.add(row);
            } else {
                ActivityFeedEventEntity row =
                        takeAnonymousMatch(
                                withoutUid,
                                event.summary(),
                                event.startsAt(),
                                event.endsAt(),
                                event.location());
                if (row == null) {
                    row =
                            new ActivityFeedEventEntity(
                                    UUID.randomUUID(),
                                    feed.id(),
                                    null,
                                    event.summary(),
                                    event.startsAt(),
                                    event.endsAt(),
                                    event.location());
                } else {
                    row.applySnapshot(
                            event.summary(), event.startsAt(), event.endsAt(), event.location());
                }
                keepIds.add(row.id());
                upserts.add(row);
            }
        }

        if (keepIds.isEmpty()) {
            events.deleteByFeedId(feed.id());
        } else {
            events.deleteByFeedIdAndIdNotIn(feed.id(), keepIds);
        }
        if (!upserts.isEmpty()) {
            events.saveAll(upserts);
        }
        feed.markSyncSuccess(Instant.now());
    }

    /**
     * Best-effort match for VEVENTs that omit UID: reuse a prior null-uid row with the same
     * fingerprint so ids do not churn when the feed is otherwise unchanged.
     */
    private static ActivityFeedEventEntity takeAnonymousMatch(
            List<ActivityFeedEventEntity> withoutUid,
            String summary,
            Instant startsAt,
            Instant endsAt,
            String location) {
        for (int i = 0; i < withoutUid.size(); i++) {
            ActivityFeedEventEntity row = withoutUid.get(i);
            if (Objects.equals(row.summary(), summary)
                    && Objects.equals(row.startsAt(), startsAt)
                    && Objects.equals(row.endsAt(), endsAt)
                    && Objects.equals(row.location(), location)) {
                withoutUid.remove(i);
                return row;
            }
        }
        return null;
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
