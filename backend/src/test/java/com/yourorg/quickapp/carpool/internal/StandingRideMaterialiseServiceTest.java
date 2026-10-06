package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.carpool.StandingRideArrangementDto;
import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import com.yourorg.quickapp.carpool.StandingRideAskKidDto;
import com.yourorg.quickapp.carpool.StandingRideAskLegDto;
import com.yourorg.quickapp.carpool.StandingRideAskTemplateDto;
import com.yourorg.quickapp.carpool.StandingRideAssignment;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StandingRideMaterialiseServiceTest {

    @Mock
    private StandingRideArrangementService arrangements;

    @Mock
    private CarpoolRideService rideService;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private CarpoolMembershipRepository memberships;

    @InjectMocks
    private StandingRideMaterialiseService service;

    private final UUID spaceId = UUID.randomUUID();
    private final UUID arrangementId = UUID.randomUUID();
    private final UUID requestingCircle = UUID.randomUUID();
    private final UUID feedId = UUID.randomUUID();
    private final UUID kidId = UUID.randomUUID();
    private final Instant week1 = Instant.parse("2026-10-06T21:00:00Z");
    private final Instant week2 = Instant.parse("2026-10-13T21:00:00Z");
    private final Instant week3 = Instant.parse("2026-10-20T21:00:00Z");

    private StandingRideArrangementDto active;

    @BeforeEach
    void setUp() {
        active =
                new StandingRideArrangementDto(
                        arrangementId,
                        spaceId,
                        requestingCircle,
                        UUID.randomUUID(),
                        new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "field 3"),
                        "America/New_York",
                        week1,
                        StandingRideAssignment.FIXED_PRIMARY,
                        StandingRideArrangementStatus.ACTIVE,
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        new StandingRideAskTemplateDto(
                                List.of(new StandingRideAskKidDto(kidId, "Sam")),
                                List.of(
                                        new StandingRideAskLegDto(
                                                CarpoolLegKind.TO,
                                                CarpoolLegPhase.ASKED_TEAM,
                                                null,
                                                null,
                                                "Home",
                                                "1 Main",
                                                CarpoolMeetSide.REQUESTER),
                                        new StandingRideAskLegDto(
                                                CarpoolLegKind.FROM,
                                                CarpoolLegPhase.ASKED_TEAM,
                                                null,
                                                null,
                                                "Home",
                                                "1 Main",
                                                CarpoolMeetSide.REQUESTER))),
                        Instant.now(),
                        null);
    }

    @Test
    void materialiseArrangementCreatesOntoMatchingWeeks() {
        when(arrangements.findBySpaceAndId(spaceId, arrangementId)).thenReturn(java.util.Optional.of(active));
        FeedCalendarEventDto e1 = tuesday(week1, "w1");
        FeedCalendarEventDto e2 = tuesday(week2, "w2");
        FeedCalendarEventDto e3 = tuesday(week3, "w3");
        when(feedCalendarApi.listEventsInRange(eq(requestingCircle), any(), any()))
                .thenReturn(List.of(e1, e2, e3));
        when(rideService.tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(e1))))
                .thenReturn(true);
        when(rideService.tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(e2))))
                .thenReturn(true);
        when(rideService.tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(e3))))
                .thenReturn(true);

        assertThat(service.materialiseArrangement(spaceId, arrangementId)).isEqualTo(3);
    }

    @Test
    void materialiseSkipsNonMatchingFingerprints() {
        when(arrangements.findBySpaceAndId(spaceId, arrangementId)).thenReturn(java.util.Optional.of(active));
        FeedCalendarEventDto match = tuesday(week1, "w1");
        FeedCalendarEventDto other =
                new FeedCalendarEventDto(
                        UUID.randomUUID(),
                        feedId,
                        "Soccer",
                        "other@example.com",
                        "Other",
                        week2,
                        week2.plusSeconds(3600),
                        "Rink A",
                        List.of(kidId));
        when(feedCalendarApi.listEventsInRange(eq(requestingCircle), any(), any()))
                .thenReturn(List.of(match, other));
        when(rideService.tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(match))))
                .thenReturn(true);

        assertThat(service.materialiseArrangement(spaceId, arrangementId)).isEqualTo(1);
        verify(rideService, never())
                .tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(other)));
    }

    @Test
    void materialiseForCircleWalksActiveArrangements() {
        UUID membershipSpace = spaceId;
        when(memberships.findByCircleIdOrderByCreatedAtAsc(requestingCircle))
                .thenReturn(
                        List.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        membershipSpace,
                                        requestingCircle,
                                        com.yourorg.quickapp.carpool.CarpoolSpaceMembership.MEMBER,
                                        Instant.now())));
        when(arrangements.listActiveForSpace(membershipSpace)).thenReturn(List.of(active));
        FeedCalendarEventDto e1 = tuesday(week1, "w1");
        when(feedCalendarApi.listEventsInRange(eq(requestingCircle), any(), any()))
                .thenReturn(List.of(e1));
        when(rideService.tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(e1))))
                .thenReturn(false);

        // false = never-overwrite skip; still counted as attempted soft path, created=0
        assertThat(
                        service.materialiseForCircle(
                                requestingCircle,
                                Instant.parse("2026-09-28T00:00:00Z"),
                                Instant.parse("2026-11-01T00:00:00Z")))
                .isEqualTo(0);
        verify(rideService).tryMaterialiseStandingOccurrence(eq(active), eq(FeedEventKey.of(e1)));
    }

    @Test
    void materialiseArrangementNoopsWhenNotActive() {
        StandingRideArrangementDto open =
                new StandingRideArrangementDto(
                        arrangementId,
                        spaceId,
                        requestingCircle,
                        UUID.randomUUID(),
                        active.fingerprint(),
                        active.timeZone(),
                        week1,
                        StandingRideAssignment.FIXED_PRIMARY,
                        StandingRideArrangementStatus.OPEN,
                        null,
                        null,
                        active.askTemplate(),
                        Instant.now(),
                        null);
        when(arrangements.findBySpaceAndId(spaceId, arrangementId)).thenReturn(java.util.Optional.of(open));

        assertThat(service.materialiseArrangement(spaceId, arrangementId)).isEqualTo(0);
        verify(rideService, never()).tryMaterialiseStandingOccurrence(any(), any());
    }

    @Test
    void clearArrangementFromCancelsMatchesAtOrAfterCutoff() {
        Instant cutoff = week2;
        FeedCalendarEventDto before = tuesday(week1, "w1");
        FeedCalendarEventDto atCutoff = tuesday(week2, "w2");
        FeedCalendarEventDto after = tuesday(week3, "w3");
        when(feedCalendarApi.listEventsInRange(eq(requestingCircle), eq(cutoff), any()))
                .thenReturn(List.of(before, atCutoff, after));
        when(rideService.cancelStandingMaterialisedOccurrence(
                        eq(arrangementId), eq(FeedEventKey.of(atCutoff))))
                .thenReturn(true);
        when(rideService.cancelStandingMaterialisedOccurrence(
                        eq(arrangementId), eq(FeedEventKey.of(after))))
                .thenReturn(true);

        assertThat(service.clearArrangementFrom(active, cutoff)).isEqualTo(2);
        verify(rideService, never())
                .cancelStandingMaterialisedOccurrence(
                        eq(arrangementId), eq(FeedEventKey.of(before)));
    }

    private FeedCalendarEventDto tuesday(Instant startsAt, String uidSuffix) {
        return new FeedCalendarEventDto(
                UUID.randomUUID(),
                feedId,
                "Soccer",
                "stub-standing-ride-" + uidSuffix + "@example.com",
                "Standing Practice",
                startsAt,
                startsAt.plusSeconds(3600),
                "Field 3",
                List.of(kidId));
    }
}
