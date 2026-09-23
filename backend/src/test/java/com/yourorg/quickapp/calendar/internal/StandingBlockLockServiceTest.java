package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
                .thenReturn(new com.yourorg.quickapp.auth.AdultResponse(adultId, "a@b.c", "A"));
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
}
