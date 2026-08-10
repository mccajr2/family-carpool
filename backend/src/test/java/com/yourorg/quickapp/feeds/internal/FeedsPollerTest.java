package com.yourorg.quickapp.feeds.internal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FeedsPollerTest {

    @Mock
    private FeedsService feedsService;

    @Mock
    private ActivityFeedRepository feeds;

    @Test
    void pollAllFeedsInvokesServiceSequentiallyAndContinuesAfterFailure() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        ActivityFeedEntity a =
                new ActivityFeedEntity(
                        first, UUID.randomUUID(), "A", "https://a.example/x.ics", Instant.now());
        ActivityFeedEntity b =
                new ActivityFeedEntity(
                        second, UUID.randomUUID(), "B", "https://b.example/y.ics", Instant.now());
        when(feeds.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(a, b));
        doThrow(new IllegalStateException("boom")).when(feedsService).pollFeed(first);

        FeedsPoller poller = new FeedsPoller(feedsService, feeds, 0L);
        poller.pollAllFeeds();

        InOrder order = inOrder(feedsService);
        order.verify(feedsService).pollFeed(first);
        order.verify(feedsService).pollFeed(second);
    }

    @Test
    void pollAllFeedsNoopsWhenEmpty() {
        when(feeds.findAllByOrderByCreatedAtAsc()).thenReturn(List.of());

        FeedsPoller poller = new FeedsPoller(feedsService, feeds, 0L);
        poller.pollAllFeeds();

        verify(feedsService, never()).pollFeed(any());
    }
}
