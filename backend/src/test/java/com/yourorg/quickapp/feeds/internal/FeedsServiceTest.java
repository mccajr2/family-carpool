package com.yourorg.quickapp.feeds.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.CreateFeedRequest;
import com.yourorg.quickapp.feeds.UpdateFeedRequest;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class FeedsServiceTest {

    @Mock
    private FamilyMembershipApi familyMembershipApi;

    @Mock
    private ActivityFeedRepository feeds;

    @Mock
    private ActivityFeedEventRepository events;

    @Mock
    private IcalFetchPort icalFetchPort;

    @Mock
    private IcalParser icalParser;

    @InjectMocks
    private FeedsService feedsService;

    @Test
    void createAutoSyncsAndStoresEvents() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.existsByCircleIdAndSourceUrl(circleId, "https://example.com/cal.ics"))
                .thenReturn(false);
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch("https://example.com/cal.ics")).thenReturn("ICS");
        when(icalParser.parse("ICS"))
                .thenReturn(
                        List.of(
                                new ParsedIcalEvent(
                                        "u1",
                                        "Game",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Field")));
        when(events.findByFeedId(any())).thenReturn(List.of());
        when(events.countByFeedId(any())).thenReturn(1L);

        var response =
                feedsService.create(
                        adult,
                        new CreateFeedRequest(
                                "U12", "webcal://example.com/cal.ics", List.of()));

        assertThat(response.sourceUrl()).isEqualTo("https://example.com/cal.ics");
        assertThat(response.lastSyncedAt()).isNotNull();
        assertThat(response.lastSyncError()).isNull();
        assertThat(response.eventCount()).isEqualTo(1);
        verify(events).deleteByFeedIdAndIdNotIn(any(), any());
        verify(events).saveAll(any());
    }

    @Test
    void createSoftFailsWhenFetchThrows() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.existsByCircleIdAndSourceUrl(eq(circleId), any())).thenReturn(false);
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch(any())).thenThrow(new IllegalStateException("boom"));
        when(events.countByFeedId(any())).thenReturn(0L);

        var response =
                feedsService.create(
                        adult, new CreateFeedRequest("U12", "https://x.example/fail.ics", null));

        assertThat(response.lastSyncedAt()).isNull();
        assertThat(response.lastSyncError()).contains("boom");
        verify(events, never()).saveAll(any());
    }

    @Test
    void updateNameOnlyDoesNotResync() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "Old", "https://example.com/cal.ics", Instant.now());
        feed.markSyncSuccess(Instant.parse("2026-08-01T00:00:00Z"));

        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.findByIdAndCircleIdForUpdate(feedId, circleId)).thenReturn(Optional.of(feed));
        when(feeds.existsByCircleIdAndSourceUrlAndIdNot(
                        circleId, "https://example.com/cal.ics", feedId))
                .thenReturn(false);
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(events.countByFeedId(feedId)).thenReturn(2L);

        var response =
                feedsService.update(
                        adult,
                        feedId,
                        new UpdateFeedRequest("New", "https://example.com/cal.ics", List.of()));

        assertThat(response.name()).isEqualTo("New");
        assertThat(response.lastSyncedAt()).isEqualTo(Instant.parse("2026-08-01T00:00:00Z"));
        verify(icalFetchPort, never()).fetch(any());
    }

    @Test
    void caregiverCannotCreate() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "c@example.com", "Care");
        when(familyMembershipApi.requireOrganizerCircleId(adultId))
                .thenThrow(new FamilyAccessException(HttpStatus.FORBIDDEN, "Organizer role required"));

        assertThatThrownBy(
                        () ->
                                feedsService.create(
                                        adult,
                                        new CreateFeedRequest(
                                                "U12", "https://example.com/a.ics", List.of())))
                .isInstanceOf(FamilyAccessException.class);
    }

    @Test
    void normalizeSourceUrlRejectsNonHttp() {
        assertThatThrownBy(() -> FeedsService.normalizeSourceUrl("ftp://x"))
                .isInstanceOf(FeedsException.class)
                .extracting(ex -> ((FeedsException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void syncUpsertsByUidAndDedupesDuplicates() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());

        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.findByIdAndCircleIdForUpdate(feedId, circleId)).thenReturn(Optional.of(feed));
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch(any())).thenReturn("ICS");
        when(icalParser.parse("ICS"))
                .thenReturn(
                        List.of(
                                new ParsedIcalEvent(
                                        "u1", "A", Instant.parse("2026-08-15T17:00:00Z"), null, null),
                                new ParsedIcalEvent(
                                        "u1", "dup", Instant.parse("2026-08-15T17:00:00Z"), null, null)));
        when(events.findByFeedId(feedId)).thenReturn(List.of());
        when(events.countByFeedId(feedId)).thenReturn(1L);

        feedsService.sync(adult, feedId);

        ArgumentCaptor<List<ActivityFeedEventEntity>> saved = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<Collection<UUID>> keepIds = ArgumentCaptor.forClass(Collection.class);
        verify(events).deleteByFeedIdAndIdNotIn(eq(feedId), keepIds.capture());
        verify(events).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(1);
        assertThat(keepIds.getValue()).containsExactly(saved.getValue().getFirst().id());
        assertThat(feed.lastSyncError()).isNull();
        assertThat(feed.kidIds()).isEqualTo(Set.of());
    }

    @Test
    void syncPreservesExistingEventIdsWhenUidMatches() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        UUID existingId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());
        ActivityFeedEventEntity existing =
                new ActivityFeedEventEntity(
                        existingId,
                        feedId,
                        "u1",
                        "Old title",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        Instant.parse("2026-08-15T18:00:00Z"),
                        "Old field");

        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.findByIdAndCircleIdForUpdate(feedId, circleId)).thenReturn(Optional.of(feed));
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch(any())).thenReturn("ICS");
        when(icalParser.parse("ICS"))
                .thenReturn(
                        List.of(
                                new ParsedIcalEvent(
                                        "u1",
                                        "Practice",
                                        Instant.parse("2026-08-15T17:30:00Z"),
                                        Instant.parse("2026-08-15T18:30:00Z"),
                                        "Field 3")));
        when(events.findByFeedId(feedId)).thenReturn(List.of(existing));
        when(events.countByFeedId(feedId)).thenReturn(1L);

        feedsService.sync(adult, feedId);

        ArgumentCaptor<List<ActivityFeedEventEntity>> saved = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<Collection<UUID>> keepIds = ArgumentCaptor.forClass(Collection.class);
        verify(events).deleteByFeedIdAndIdNotIn(eq(feedId), keepIds.capture());
        verify(events).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(1);
        assertThat(saved.getValue().getFirst().id()).isEqualTo(existingId);
        assertThat(saved.getValue().getFirst().summary()).isEqualTo("Practice");
        assertThat(saved.getValue().getFirst().location()).isEqualTo("Field 3");
        assertThat(keepIds.getValue()).containsExactly(existingId);
        verify(events, never()).deleteByFeedId(feedId);
    }

    @Test
    void syncDeletesRemovedEventsAndClearsWhenEmpty() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());

        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.findByIdAndCircleIdForUpdate(feedId, circleId)).thenReturn(Optional.of(feed));
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch(any())).thenReturn("ICS");
        when(icalParser.parse("ICS")).thenReturn(List.of());
        when(events.findByFeedId(feedId)).thenReturn(List.of());
        when(events.countByFeedId(feedId)).thenReturn(0L);

        feedsService.sync(adult, feedId);

        verify(events).deleteByFeedId(feedId);
        verify(events, never()).deleteByFeedIdAndIdNotIn(any(), any());
        verify(events, never()).saveAll(any());
    }

    @Test
    void syncDoesNotSoftFailWhenEventDeleteThrows() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());

        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feeds.findByIdAndCircleIdForUpdate(feedId, circleId)).thenReturn(Optional.of(feed));
        when(icalFetchPort.fetch(any())).thenReturn("ICS");
        when(icalParser.parse("ICS"))
                .thenReturn(
                        List.of(
                                new ParsedIcalEvent(
                                        "u1",
                                        "A",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        null)));
        when(events.findByFeedId(feedId)).thenReturn(List.of());
        org.mockito.Mockito.doThrow(
                        new org.springframework.orm.ObjectOptimisticLockingFailureException(
                                ActivityFeedEventEntity.class, feedId))
                .when(events)
                .deleteByFeedIdAndIdNotIn(eq(feedId), any());

        assertThatThrownBy(() -> feedsService.sync(adult, feedId))
                .isInstanceOf(
                        org.springframework.orm.ObjectOptimisticLockingFailureException.class);
        assertThat(feed.lastSyncError()).isNull();
        verify(events, never()).saveAll(any());
    }

    @Test
    void pollAllFeedsSyncsEachFeedAndSoftFailsIndependently() {
        UUID okId = UUID.randomUUID();
        UUID failId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        ActivityFeedEntity ok =
                new ActivityFeedEntity(
                        okId, circleId, "Ok", "https://example.com/ok.ics", Instant.now());
        ActivityFeedEntity fail =
                new ActivityFeedEntity(
                        failId, circleId, "Fail", "https://example.com/fail.ics", Instant.now());
        fail.markSyncSuccess(Instant.parse("2026-08-01T00:00:00Z"));

        when(feeds.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(ok, fail));
        when(feeds.findByIdForUpdate(okId)).thenReturn(Optional.of(ok));
        when(feeds.findByIdForUpdate(failId)).thenReturn(Optional.of(fail));
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch("https://example.com/ok.ics")).thenReturn("ICS");
        when(icalParser.parse("ICS"))
                .thenReturn(
                        List.of(
                                new ParsedIcalEvent(
                                        "u1",
                                        "Game",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        null)));
        when(events.findByFeedId(okId)).thenReturn(List.of());
        when(icalFetchPort.fetch("https://example.com/fail.ics"))
                .thenThrow(new IllegalStateException("timeout"));

        int attempted = feedsService.pollAllFeeds();

        assertThat(attempted).isEqualTo(2);
        assertThat(ok.lastSyncedAt()).isNotNull();
        assertThat(ok.lastSyncError()).isNull();
        assertThat(fail.lastSyncedAt()).isEqualTo(Instant.parse("2026-08-01T00:00:00Z"));
        assertThat(fail.lastSyncError()).contains("timeout");
        verify(events).deleteByFeedIdAndIdNotIn(eq(okId), any());
        verify(events, never()).deleteByFeedId(okId);
        verify(events, never()).findByFeedId(failId);
        verify(feeds, org.mockito.Mockito.times(2)).save(any());
    }

    @Test
    void pollFeedNoopsWhenMissing() {
        UUID missing = UUID.randomUUID();
        when(feeds.findByIdForUpdate(missing)).thenReturn(Optional.empty());

        feedsService.pollFeed(missing);

        verify(icalFetchPort, never()).fetch(any());
        verify(feeds, never()).save(any());
    }

    @Test
    void listByCircleDoesNotRequireOrganizer() {
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());
        when(feeds.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(feed));
        when(events.countByFeedId(feedId)).thenReturn(3L);

        var listed = feedsService.listByCircle(circleId);

        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().id()).isEqualTo(feedId);
        assertThat(listed.getFirst().eventCount()).isEqualTo(3);
        verify(familyMembershipApi, never()).requireOrganizerCircleId(any());
    }

    @Test
    void findByCircleAndNormalizedUrlNormalizesWebcal() {
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        ActivityFeedEntity feed =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());
        when(feeds.findByCircleIdAndSourceUrl(circleId, "https://example.com/cal.ics"))
                .thenReturn(Optional.of(feed));
        when(events.countByFeedId(feedId)).thenReturn(0L);

        var found =
                feedsService.findByCircleAndNormalizedUrl(
                        circleId, "webcal://example.com/cal.ics");

        assertThat(found).isPresent();
        assertThat(found.get().id()).isEqualTo(feedId);
        verify(familyMembershipApi, never()).requireOrganizerCircleId(any());
    }

    @Test
    void findByCircleAndNormalizedUrlEmptyWhenMissing() {
        UUID circleId = UUID.randomUUID();
        when(feeds.findByCircleIdAndSourceUrl(circleId, "https://example.com/missing.ics"))
                .thenReturn(Optional.empty());

        assertThat(
                        feedsService.findByCircleAndNormalizedUrl(
                                circleId, "https://example.com/missing.ics"))
                .isEmpty();
    }

    @Test
    void ensureFeedCreatesWithZeroKidsAndSyncsWithoutOrganizer() {
        UUID circleId = UUID.randomUUID();
        when(feeds.findByCircleIdAndSourceUrl(circleId, "https://example.com/cal.ics"))
                .thenReturn(Optional.empty());
        when(feeds.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(icalFetchPort.fetch("https://example.com/cal.ics")).thenReturn("ICS");
        when(icalParser.parse("ICS"))
                .thenReturn(
                        List.of(
                                new ParsedIcalEvent(
                                        "u1",
                                        "Game",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        null,
                                        null)));
        when(events.findByFeedId(any())).thenReturn(List.of());
        when(events.countByFeedId(any())).thenReturn(1L);

        var response =
                feedsService.ensureFeed(circleId, "webcal://example.com/cal.ics", "Soccer");

        assertThat(response.name()).isEqualTo("Soccer");
        assertThat(response.sourceUrl()).isEqualTo("https://example.com/cal.ics");
        assertThat(response.kidIds()).isEmpty();
        assertThat(response.lastSyncedAt()).isNotNull();
        assertThat(response.eventCount()).isEqualTo(1);
        ArgumentCaptor<ActivityFeedEntity> saved = ArgumentCaptor.forClass(ActivityFeedEntity.class);
        verify(feeds, org.mockito.Mockito.atLeastOnce()).save(saved.capture());
        assertThat(saved.getAllValues().getFirst().kidIds()).isEmpty();
        verify(familyMembershipApi, never()).requireOrganizerCircleId(any());
        verify(familyMembershipApi, never()).requireKidsInCircle(any(), any());
    }

    @Test
    void ensureFeedReturnsExistingWithoutDuplicateOrResync() {
        UUID circleId = UUID.randomUUID();
        UUID feedId = UUID.randomUUID();
        ActivityFeedEntity existing =
                new ActivityFeedEntity(
                        feedId, circleId, "U12", "https://example.com/cal.ics", Instant.now());
        existing.setKidIds(Set.of(UUID.randomUUID()));
        existing.markSyncSuccess(Instant.parse("2026-08-01T00:00:00Z"));
        when(feeds.findByCircleIdAndSourceUrl(circleId, "https://example.com/cal.ics"))
                .thenReturn(Optional.of(existing));
        when(events.countByFeedId(feedId)).thenReturn(4L);

        var response =
                feedsService.ensureFeed(circleId, "https://example.com/cal.ics", "Ignored name");

        assertThat(response.id()).isEqualTo(feedId);
        assertThat(response.name()).isEqualTo("U12");
        assertThat(response.kidIds()).hasSize(1);
        assertThat(response.eventCount()).isEqualTo(4);
        verify(feeds, never()).save(any());
        verify(icalFetchPort, never()).fetch(any());
        verify(familyMembershipApi, never()).requireOrganizerCircleId(any());
    }
}
