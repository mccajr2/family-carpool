package com.yourorg.quickapp.feeds.internal;

import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class FeedCalendarApiImpl implements FeedCalendarApi {

    private final ActivityFeedRepository feeds;
    private final ActivityFeedEventRepository events;

    FeedCalendarApiImpl(ActivityFeedRepository feeds, ActivityFeedEventRepository events) {
        this.feeds = feeds;
        this.events = events;
    }

    @Override
    @Transactional(readOnly = true)
    public List<FeedCalendarEventDto> listEventsInRange(UUID circleId, Instant from, Instant to) {
        List<ActivityFeedEntity> circleFeeds = feeds.findByCircleIdOrderByCreatedAtAsc(circleId);
        if (circleFeeds.isEmpty()) {
            return List.of();
        }
        Map<UUID, ActivityFeedEntity> byId =
                circleFeeds.stream()
                        .collect(Collectors.toMap(ActivityFeedEntity::id, Function.identity()));
        List<UUID> feedIds = circleFeeds.stream().map(ActivityFeedEntity::id).toList();
        return events
                .findByFeedIdInAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                        feedIds, from, to)
                .stream()
                .map(
                        event -> {
                            ActivityFeedEntity feed = byId.get(event.feedId());
                            return toDto(event, feed);
                        })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<FeedCalendarEventDto> listEventsOverlapping(
            UUID circleId, Instant windowStart, Instant windowEnd) {
        if (windowStart == null || windowEnd == null) {
            return List.of();
        }
        List<ActivityFeedEntity> circleFeeds = feeds.findByCircleIdOrderByCreatedAtAsc(circleId);
        if (circleFeeds.isEmpty()) {
            return List.of();
        }
        Instant queryEnd =
                windowStart.isBefore(windowEnd) ? windowEnd : windowStart.plusNanos(1);
        Map<UUID, ActivityFeedEntity> byId =
                circleFeeds.stream()
                        .collect(Collectors.toMap(ActivityFeedEntity::id, Function.identity()));
        List<UUID> feedIds = circleFeeds.stream().map(ActivityFeedEntity::id).toList();
        return events.findOverlapping(feedIds, windowStart, queryEnd).stream()
                .map(
                        event -> {
                            ActivityFeedEntity feed = byId.get(event.feedId());
                            return toDto(event, feed);
                        })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FeedCalendarEventDto> findEventInCircle(UUID circleId, UUID itemId) {
        return events
                .findById(itemId)
                .flatMap(
                        event ->
                                feeds.findByIdAndCircleId(event.feedId(), circleId)
                                        .map(feed -> toDto(event, feed)));
    }

    private static FeedCalendarEventDto toDto(
            ActivityFeedEventEntity event, ActivityFeedEntity feed) {
        return new FeedCalendarEventDto(
                event.id(),
                feed.id(),
                feed.name(),
                IcalParser.normalizeIcalText(event.summary()),
                event.startsAt(),
                event.endsAt(),
                IcalParser.normalizeIcalText(event.location()),
                List.copyOf(feed.kidIds()));
    }
}
