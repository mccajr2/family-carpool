package com.yourorg.quickapp.events.internal;

import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ManualEventCalendarApiImpl implements ManualEventCalendarApi {

    private final ManualEventRepository events;
    private final FeedsApi feedsApi;

    ManualEventCalendarApiImpl(ManualEventRepository events, FeedsApi feedsApi) {
        this.events = events;
        this.feedsApi = feedsApi;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManualCalendarEventDto> listInRange(UUID circleId, Instant from, Instant to) {
        Map<UUID, String> feedNames = feedNamesById(circleId);
        return events
                .findByCircleIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                        circleId, from, to)
                .stream()
                .map(event -> toDto(event, feedNames))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManualCalendarEventDto> listOverlapping(
            UUID circleId, Instant windowStart, Instant windowEnd) {
        if (windowStart == null || windowEnd == null) {
            return List.of();
        }
        Instant queryEnd =
                windowStart.isBefore(windowEnd) ? windowEnd : windowStart.plusNanos(1);
        Map<UUID, String> feedNames = feedNamesById(circleId);
        return events.findOverlapping(circleId, windowStart, queryEnd).stream()
                .map(event -> toDto(event, feedNames))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManualCalendarEventDto> listLinkedToFeedInRange(
            UUID circleId, UUID feedId, Instant from, Instant to) {
        if (feedId == null) {
            return List.of();
        }
        Map<UUID, String> feedNames = feedNamesById(circleId);
        return events
                .findByCircleIdAndFeedIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                        circleId, feedId, from, to)
                .stream()
                .map(event -> toDto(event, feedNames))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ManualCalendarEventDto> findInCircle(UUID circleId, UUID itemId) {
        Map<UUID, String> feedNames = feedNamesById(circleId);
        return events.findByIdAndCircleId(itemId, circleId).map(event -> toDto(event, feedNames));
    }

    private Map<UUID, String> feedNamesById(UUID circleId) {
        Map<UUID, String> names = new HashMap<>();
        for (FeedResponse feed : feedsApi.listByCircle(circleId)) {
            names.put(feed.id(), feed.name());
        }
        return names;
    }

    private static ManualCalendarEventDto toDto(
            ManualEventEntity event, Map<UUID, String> feedNames) {
        UUID feedId = event.feedId();
        String feedName = feedId == null ? null : feedNames.get(feedId);
        return new ManualCalendarEventDto(
                event.id(),
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                List.copyOf(event.kidIds()),
                feedId,
                feedName);
    }
}
