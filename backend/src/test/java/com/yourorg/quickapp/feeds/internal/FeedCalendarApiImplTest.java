package com.yourorg.quickapp.feeds.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FeedCalendarApiImplTest {

    @Mock
    private ActivityFeedRepository feeds;

    @Mock
    private ActivityFeedEventRepository events;

    @InjectMocks
    private FeedCalendarApiImpl api;

    @Test
    void listEventsInRange_decodesHtmlEntitiesOnAlreadyStoredRows() {
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        Instant from = Instant.parse("2026-09-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-30T00:00:00Z");
        Instant startsAt = Instant.parse("2026-09-05T08:00:00Z");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "Sharks", "https://example.com/cal.ics", Instant.now());
        ActivityFeedEventEntity stored =
                new ActivityFeedEventEntity(
                        eventId,
                        feedId,
                        "html-1",
                        "2016/2017 (BILL): Team &amp; Family Meeting",
                        startsAt,
                        null,
                        "Rink &lt;A&gt;");

        when(feeds.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(feed));
        when(events
                        .findByFeedIdInAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                                eq(List.of(feedId)), eq(from), eq(to)))
                .thenReturn(List.of(stored));

        var items = api.listEventsInRange(circleId, from, to);

        assertThat(items).hasSize(1);
        assertThat(items.getFirst().id()).isEqualTo(eventId);
        assertThat(items.getFirst().uid()).isEqualTo("html-1");
        assertThat(items.getFirst().title()).isEqualTo("2016/2017 (BILL): Team & Family Meeting");
        assertThat(items.getFirst().location()).isEqualTo("Rink <A>");
    }

    @Test
    void listEventsInRange_exposesNullUidWhenEventHasNone() {
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        Instant from = Instant.parse("2026-09-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-30T00:00:00Z");
        Instant startsAt = Instant.parse("2026-09-05T08:00:00Z");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "Sharks", "https://example.com/cal.ics", Instant.now());
        ActivityFeedEventEntity stored =
                new ActivityFeedEventEntity(
                        eventId, feedId, null, "Practice", startsAt, null, "Field 3");

        when(feeds.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(feed));
        when(events
                        .findByFeedIdInAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                                eq(List.of(feedId)), eq(from), eq(to)))
                .thenReturn(List.of(stored));

        var items = api.listEventsInRange(circleId, from, to);

        assertThat(items).hasSize(1);
        assertThat(items.getFirst().uid()).isNull();
    }

    @Test
    void listEventsInRange_returnsEmptyWhenCircleHasNoFeeds() {
        UUID circleId = UUID.randomUUID();
        when(feeds.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());

        assertThat(
                        api.listEventsInRange(
                                circleId,
                                Instant.parse("2026-09-01T00:00:00Z"),
                                Instant.parse("2026-09-30T00:00:00Z")))
                .isEmpty();
    }
}
