package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.StandingBlockMemberSnapshotDto;
import com.yourorg.quickapp.calendar.StandingBlockTemplateDto;
import com.yourorg.quickapp.calendar.StandingCoverageSnapshotDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import java.time.DayOfWeek;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StandingBlockLockServiceTest {

    @Mock
    private StandingBlockTemplateService templates;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private CoverageApi coverageApi;

    @Mock
    private CarpoolApi carpoolApi;

    @Mock
    private LeaveByApi leaveByApi;

    @Mock
    private AdultSessionApi adultSessionApi;

    @InjectMocks
    private StandingBlockLockService service;

    private final UUID circleId = UUID.randomUUID();
    private final UUID feedId = UUID.randomUUID();
    private final Instant from = Instant.parse("2026-09-01T04:00:00Z");
    private final Instant to = Instant.parse("2026-10-01T04:00:00Z");

    @Test
    void autoClearsWhenEveryFingerprintHasZeroUpcomingMatches() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        UUID templateId = UUID.randomUUID();
        StandingBlockTemplateDto template =
                new StandingBlockTemplateDto(
                        templateId,
                        circleId,
                        UUID.randomUUID(),
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"),
                        List.of(
                                new StandingBlockMemberSnapshotDto(
                                        fp, 0, List.of(), List.of(), List.of())));
        when(templates.listForCircle(circleId)).thenReturn(List.of(template));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of());
        when(templates.delete(circleId, templateId)).thenReturn(true);

        service.applyAndAutoClear(circleId, from, to);

        verify(templates).delete(circleId, templateId);
        verify(coverageApi, never()).assign(any(), any(), any(), any(), any());
    }

    @Test
    void skipsApplyWhenTargetAlreadyHasCoverage() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        UUID templateId = UUID.randomUUID();
        UUID adultId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        StandingBlockTemplateDto template =
                new StandingBlockTemplateDto(
                        templateId,
                        circleId,
                        adultId,
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"),
                        List.of(
                                new StandingBlockMemberSnapshotDto(
                                        fp,
                                        0,
                                        List.of(
                                                new StandingCoverageSnapshotDto(
                                                        adultId,
                                                        adultId,
                                                        CoverageStatus.CONFIRMED,
                                                        List.of(kidId),
                                                        null,
                                                        null)),
                                        List.of(),
                                        List.of())));
        FeedCalendarEventDto week2 =
                new FeedCalendarEventDto(
                        UUID.randomUUID(),
                        feedId,
                        "Mites",
                        "uid-2",
                        "Practice",
                        Instant.parse("2026-09-08T21:00:00Z"),
                        Instant.parse("2026-09-08T22:00:00Z"),
                        "Rink A",
                        List.of(kidId));
        when(templates.listForCircle(circleId)).thenReturn(List.of(template));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(week2));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, week2.id()))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.FEED,
                                        week2.id(),
                                        adultId,
                                        adultId,
                                        List.of(kidId),
                                        CoverageStatus.CONFIRMED,
                                        null,
                                        null,
                                        Instant.now(),
                                        Instant.now())));

        service.applyAndAutoClear(circleId, from, to);

        verify(templates, never()).delete(eq(circleId), any());
        verify(coverageApi, never()).assign(any(), any(), any(), any(), any());
    }

    @Test
    void skipsApplyWhenTargetAlreadyHasRidePlans() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        UUID adultId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        StandingBlockTemplateDto template =
                new StandingBlockTemplateDto(
                        UUID.randomUUID(),
                        circleId,
                        adultId,
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"),
                        List.of(
                                new StandingBlockMemberSnapshotDto(
                                        fp,
                                        0,
                                        List.of(
                                                new StandingCoverageSnapshotDto(
                                                        adultId,
                                                        adultId,
                                                        CoverageStatus.CONFIRMED,
                                                        List.of(kidId),
                                                        null,
                                                        null)),
                                        List.of(),
                                        List.of())));
        FeedCalendarEventDto week2 =
                event(
                        "uid-edited",
                        Instant.parse("2026-09-08T21:00:00Z"),
                        Instant.parse("2026-09-08T22:00:00Z"),
                        "Rink A",
                        kidId);
        when(templates.listForCircle(circleId)).thenReturn(List.of(template));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(week2));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, week2.id()))
                .thenReturn(List.of());
        when(carpoolApi.hasActiveOwnPlansForFeedEvent(circleId, week2.id())).thenReturn(true);

        service.applyAndAutoClear(circleId, from, to);

        verify(coverageApi, never()).assign(any(), any(), any(), any(), any());
    }

    @Test
    void appliesCoverageOntoBlankFutureMatch() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        UUID adultId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        StandingBlockTemplateDto template =
                new StandingBlockTemplateDto(
                        UUID.randomUUID(),
                        circleId,
                        adultId,
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"),
                        List.of(
                                new StandingBlockMemberSnapshotDto(
                                        fp,
                                        0,
                                        List.of(
                                                new StandingCoverageSnapshotDto(
                                                        adultId,
                                                        adultId,
                                                        CoverageStatus.CONFIRMED,
                                                        List.of(kidId),
                                                        null,
                                                        null)),
                                        List.of(),
                                        List.of())));
        FeedCalendarEventDto week2 =
                new FeedCalendarEventDto(
                        UUID.randomUUID(),
                        feedId,
                        "Mites",
                        "uid-2",
                        "Practice",
                        Instant.parse("2026-09-08T21:00:00Z"),
                        Instant.parse("2026-09-08T22:00:00Z"),
                        "Rink A",
                        List.of(kidId));
        when(templates.listForCircle(circleId)).thenReturn(List.of(template));
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(week2));
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, week2.id()))
                .thenReturn(List.of());
        when(carpoolApi.hasActiveOwnPlansForFeedEvent(circleId, week2.id())).thenReturn(false);
        when(adultSessionApi.requireAdult(adultId))
                .thenReturn(new AdultResponse(adultId, "a@b.c", "A"));
        CoverageAssignmentDto created =
                new CoverageAssignmentDto(
                        UUID.randomUUID(),
                        CoverageItemSource.FEED,
                        week2.id(),
                        adultId,
                        adultId,
                        List.of(kidId),
                        CoverageStatus.CONFIRMED,
                        null,
                        null,
                        Instant.now(),
                        Instant.now());
        when(coverageApi.assign(
                        adultId,
                        CoverageItemSource.FEED,
                        week2.id(),
                        adultId,
                        List.of(kidId)))
                .thenReturn(created);

        service.applyAndAutoClear(circleId, from, to);

        verify(coverageApi)
                .assign(adultId, CoverageItemSource.FEED, week2.id(), adultId, List.of(kidId));
        assertThat(created.status()).isEqualTo(CoverageStatus.CONFIRMED);
    }

    @Test
    void appliesMultiMemberBlockOntoBlankFutureDayWithDifferentUids() {
        // Two fingerprints on the same Tuesday; week-2 UIDs differ from lock week —
        // UID-only matching would miss both targets.
        RecurringFeedFingerprint fpA =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "field 3");
        RecurringFeedFingerprint fpB =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 18 * 60, "field 3");
        UUID adultId = UUID.randomUUID();
        UUID kidA = UUID.randomUUID();
        UUID kidB = UUID.randomUUID();
        StandingBlockTemplateDto template =
                new StandingBlockTemplateDto(
                        UUID.randomUUID(),
                        circleId,
                        adultId,
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"),
                        List.of(
                                new StandingBlockMemberSnapshotDto(
                                        fpA,
                                        0,
                                        List.of(
                                                new StandingCoverageSnapshotDto(
                                                        adultId,
                                                        adultId,
                                                        CoverageStatus.CONFIRMED,
                                                        List.of(kidA),
                                                        null,
                                                        null)),
                                        List.of(),
                                        List.of()),
                                new StandingBlockMemberSnapshotDto(
                                        fpB,
                                        1,
                                        List.of(
                                                new StandingCoverageSnapshotDto(
                                                        adultId,
                                                        adultId,
                                                        CoverageStatus.CONFIRMED,
                                                        List.of(kidB),
                                                        null,
                                                        null)),
                                        List.of(),
                                        List.of())));

        FeedCalendarEventDto week2A =
                event(
                        "uid-a-week2-different",
                        Instant.parse("2026-09-08T21:00:00Z"),
                        Instant.parse("2026-09-08T22:00:00Z"),
                        "Field 3",
                        kidA);
        FeedCalendarEventDto week2B =
                event(
                        "uid-b-week2-different",
                        Instant.parse("2026-09-08T22:00:00Z"),
                        Instant.parse("2026-09-08T23:00:00Z"),
                        "Field 3",
                        kidB);

        when(templates.listForCircle(circleId)).thenReturn(List.of(template));
        when(feedCalendarApi.listEventsInRange(circleId, from, to))
                .thenReturn(List.of(week2A, week2B));
        when(coverageApi.listForItem(eq(circleId), eq(CoverageItemSource.FEED), any()))
                .thenReturn(List.of());
        when(carpoolApi.hasActiveOwnPlansForFeedEvent(eq(circleId), any())).thenReturn(false);
        when(adultSessionApi.requireAdult(adultId))
                .thenReturn(new AdultResponse(adultId, "a@b.c", "A"));
        when(coverageApi.assign(any(), any(), any(), any(), any()))
                .thenAnswer(
                        inv -> {
                            UUID itemId = inv.getArgument(2);
                            @SuppressWarnings("unchecked")
                            List<UUID> kids = inv.getArgument(4);
                            return new CoverageAssignmentDto(
                                    UUID.randomUUID(),
                                    CoverageItemSource.FEED,
                                    itemId,
                                    adultId,
                                    adultId,
                                    kids,
                                    CoverageStatus.CONFIRMED,
                                    null,
                                    null,
                                    Instant.now(),
                                    Instant.now());
                        });

        service.applyAndAutoClear(circleId, from, to);

        verify(coverageApi)
                .assign(adultId, CoverageItemSource.FEED, week2A.id(), adultId, List.of(kidA));
        verify(coverageApi)
                .assign(adultId, CoverageItemSource.FEED, week2B.id(), adultId, List.of(kidB));
    }

    @Test
    void lockRejectsWhenGateFails() {
        AdultResponse adult = new AdultResponse(UUID.randomUUID(), "a@b.c", "A");
        UUID kidId = UUID.randomUUID();
        FeedCalendarEventDto only =
                event(
                        "uid-1",
                        Instant.parse("2026-09-01T21:00:00Z"),
                        Instant.parse("2026-09-01T22:00:00Z"),
                        "Rink A",
                        kidId);
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(List.of(only));

        assertThatThrownBy(
                        () ->
                                service.lock(
                                        adult,
                                        circleId,
                                        List.of(only.id()),
                                        "America/New_York",
                                        from,
                                        to))
                .isInstanceOf(CalendarException.class)
                .satisfies(
                        ex ->
                                assertThat(((CalendarException) ex).status().value())
                                        .isEqualTo(409));
        verify(templates, never()).save(any(), any(), any(), any());
    }

    @Test
    void lockPersistsSnapshotWhenGatePassesAndApplies() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@b.c", "A");
        UUID kidId = UUID.randomUUID();
        List<FeedCalendarEventDto> horizon = tuesdayOccurrences("uid-lock-", kidId, 4);
        FeedCalendarEventDto lockWeek = horizon.getFirst();
        when(feedCalendarApi.listEventsInRange(circleId, from, to)).thenReturn(horizon);
        when(coverageApi.listForItem(circleId, CoverageItemSource.FEED, lockWeek.id()))
                .thenReturn(
                        List.of(
                                new CoverageAssignmentDto(
                                        UUID.randomUUID(),
                                        CoverageItemSource.FEED,
                                        lockWeek.id(),
                                        adultId,
                                        adultId,
                                        List.of(kidId),
                                        CoverageStatus.CONFIRMED,
                                        null,
                                        null,
                                        Instant.now(),
                                        Instant.now())));
        when(carpoolApi.listActiveOwnPlansForFeedEvent(circleId, lockWeek.id()))
                .thenReturn(List.of());
        when(leaveByApi.findItineraryHomeSide(any(), any(), any()))
                .thenReturn(Optional.empty());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<StandingBlockMemberSnapshotDto>> membersCaptor =
                ArgumentCaptor.forClass(List.class);
        StandingBlockTemplateDto saved =
                new StandingBlockTemplateDto(
                        UUID.randomUUID(),
                        circleId,
                        adultId,
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"),
                        List.of());
        when(templates.save(
                        eq(circleId), eq(adultId), eq("America/New_York"), membersCaptor.capture()))
                .thenReturn(saved);
        when(templates.findByCircleAndFingerprints(eq(circleId), any()))
                .thenReturn(Optional.of(saved));
        // applyAndAutoClear path after save
        when(templates.listForCircle(circleId)).thenReturn(List.of());

        StandingBlockTemplateDto result =
                service.lock(
                        adult,
                        circleId,
                        List.of(lockWeek.id()),
                        "America/New_York",
                        from,
                        to);

        assertThat(result.id()).isEqualTo(saved.id());
        List<StandingBlockMemberSnapshotDto> members = membersCaptor.getValue();
        assertThat(members).hasSize(1);
        assertThat(members.getFirst().coverages()).hasSize(1);
        assertThat(members.getFirst().fingerprint().feedId()).isEqualTo(feedId);
        verify(templates).save(eq(circleId), eq(adultId), eq("America/New_York"), any());
    }

    @Test
    void removeDeletesTemplate() {
        UUID templateId = UUID.randomUUID();
        when(templates.delete(circleId, templateId)).thenReturn(true);
        assertThat(service.remove(circleId, templateId)).isTrue();
        verify(templates).delete(circleId, templateId);
    }

    private FeedCalendarEventDto event(
            String uid, Instant starts, Instant ends, String location, UUID kidId) {
        return new FeedCalendarEventDto(
                UUID.randomUUID(),
                feedId,
                "Mites",
                uid,
                "Practice",
                starts,
                ends,
                location,
                List.of(kidId));
    }

    /** Four consecutive Tuesday 17:00 America/New_York practices (21:00Z). */
    private List<FeedCalendarEventDto> tuesdayOccurrences(String uidPrefix, UUID kidId, int n) {
        List<FeedCalendarEventDto> out = new ArrayList<>(n);
        Instant start = Instant.parse("2026-09-01T21:00:00Z");
        for (int i = 0; i < n; i++) {
            Instant s = start.plusSeconds(i * 7L * 24 * 3600);
            out.add(event(uidPrefix + i, s, s.plusSeconds(3600), "Rink A", kidId));
        }
        return out;
    }
}
