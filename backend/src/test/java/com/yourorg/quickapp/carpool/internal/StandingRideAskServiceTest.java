package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.carpool.CarpoolRidePlanLegAction;
import com.yourorg.quickapp.carpool.CreateStandingRideArrangementRequest;
import com.yourorg.quickapp.carpool.SaveCarpoolRidePlanLeg;
import com.yourorg.quickapp.carpool.StandingRideArrangementDto;
import com.yourorg.quickapp.carpool.StandingRideArrangementResponse;
import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import com.yourorg.quickapp.carpool.StandingRideAskKidDto;
import com.yourorg.quickapp.carpool.StandingRideAskLegDto;
import com.yourorg.quickapp.carpool.StandingRideAskTemplateDto;
import com.yourorg.quickapp.carpool.StandingRideAssignment;
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class StandingRideAskServiceTest {

    @Mock
    private StandingRideArrangementService arrangements;

    @Mock
    private StandingRideArrangementPassRepository passes;

    @Mock
    private FamilyMembershipApi familyMembershipApi;

    @Mock
    private FamilyPlaceApi familyPlaceApi;

    @Mock
    private FeedsApi feedsApi;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private CarpoolSpaceRepository spaces;

    @Mock
    private CarpoolMembershipRepository memberships;

    @InjectMocks
    private StandingRideAskService service;

    private final UUID spaceId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID adultId = UUID.randomUUID();
    private final UUID kidId = UUID.randomUUID();
    private final UUID feedId = UUID.randomUUID();
    private final AdultResponse adult = new AdultResponse(adultId, "standing@example.com", "Alex");

    @BeforeEach
    void membership() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        CarpoolSpaceEntity space =
                new CarpoolSpaceEntity(
                        spaceId,
                        "Team",
                        "https://example.com/standing-ride-series.ics",
                        "CODE12",
                        Instant.now());
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(
                        Optional.of(
                                new CarpoolMembershipEntity(
                                        UUID.randomUUID(),
                                        spaceId,
                                        circleId,
                                        com.yourorg.quickapp.carpool.CarpoolSpaceMembership.OWNER,
                                        Instant.now())));
    }

    @Test
    void createRejectsWhenFewerThanThreeOtherUpcomingMatches() {
        FeedCalendarEventDto member = tuesday(Instant.parse("2026-10-06T21:00:00Z"), "w1");
        when(feedsApi.findByCircleAndNormalizedUrl(eq(circleId), any()))
                .thenReturn(
                        Optional.of(
                                new FeedResponse(
                                        feedId,
                                        "Soccer",
                                        "https://example.com/x.ics",
                                        List.of(kidId),
                                        null,
                                        null,
                                        3)));
        when(feedCalendarApi.listEventsInRange(eq(circleId), any(), any()))
                .thenReturn(
                        List.of(
                                member,
                                tuesday(Instant.parse("2026-10-13T21:00:00Z"), "w2"),
                                tuesday(Instant.parse("2026-10-20T21:00:00Z"), "w3")));

        assertThatThrownBy(
                        () ->
                                service.create(
                                        adult,
                                        spaceId,
                                        new CreateStandingRideArrangementRequest(
                                                FeedEventKey.of(member),
                                                "America/New_York",
                                                List.of(kidId),
                                                bothAsked())))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex -> assertThat(((CarpoolException) ex).status()).isEqualTo(HttpStatus.CONFLICT));
        verify(arrangements, never()).create(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void createPersistsWhenGatePasses() {
        FeedCalendarEventDto member = tuesday(Instant.parse("2026-10-06T21:00:00Z"), "w1");
        List<FeedCalendarEventDto> horizon = new ArrayList<>();
        horizon.add(member);
        horizon.add(tuesday(Instant.parse("2026-10-13T21:00:00Z"), "w2"));
        horizon.add(tuesday(Instant.parse("2026-10-20T21:00:00Z"), "w3"));
        horizon.add(tuesday(Instant.parse("2026-10-27T21:00:00Z"), "w4"));
        when(feedsApi.findByCircleAndNormalizedUrl(eq(circleId), any()))
                .thenReturn(
                        Optional.of(
                                new FeedResponse(
                                        feedId,
                                        "Soccer",
                                        "https://example.com/x.ics",
                                        List.of(kidId),
                                        null,
                                        null,
                                        4)));
        when(feedCalendarApi.listEventsInRange(eq(circleId), any(), any())).thenReturn(horizon);
        when(familyMembershipApi.findKids(circleId, List.of(kidId)))
                .thenReturn(List.of(new FamilyKidName(kidId, "Sam")));
        when(familyPlaceApi.findDefaultLeaveFromForMember(adultId))
                .thenReturn(
                        Optional.of(
                                new CirclePlaceDto(
                                        UUID.randomUUID(),
                                        circleId,
                                        "Home",
                                        "1 Main",
                                        40.0,
                                        -74.0)));
        StandingRideArrangementDto saved =
                new StandingRideArrangementDto(
                        UUID.randomUUID(),
                        spaceId,
                        circleId,
                        adultId,
                        RecurringFeedFingerprint.of(member, java.time.ZoneId.of("America/New_York")),
                        "America/New_York",
                        member.startsAt(),
                        StandingRideAssignment.FIXED_PRIMARY,
                        StandingRideArrangementStatus.OPEN,
                        null,
                        null,
                        new StandingRideAskTemplateDto(
                                List.of(new StandingRideAskKidDto(kidId, "Sam")),
                                List.of(
                                        new StandingRideAskLegDto(
                                                CarpoolLegKind.TO,
                                                com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM,
                                                null,
                                                null,
                                                "Home",
                                                "1 Main",
                                                CarpoolMeetSide.REQUESTER),
                                        new StandingRideAskLegDto(
                                                CarpoolLegKind.FROM,
                                                com.yourorg.quickapp.carpool.CarpoolLegPhase.ASKED_TEAM,
                                                null,
                                                null,
                                                "Home",
                                                "1 Main",
                                                CarpoolMeetSide.REQUESTER))),
                        Instant.now(),
                        null);
        when(arrangements.create(any(), any(), any(), any(), any(), any(), any())).thenReturn(saved);

        StandingRideArrangementResponse response =
                service.create(
                        adult,
                        spaceId,
                        new CreateStandingRideArrangementRequest(
                                FeedEventKey.of(member),
                                "America/New_York",
                                List.of(kidId),
                                bothAsked()));

        assertThat(response.status()).isEqualTo(StandingRideArrangementStatus.OPEN);
        ArgumentCaptor<RecurringFeedFingerprint> fpCaptor =
                ArgumentCaptor.forClass(RecurringFeedFingerprint.class);
        verify(arrangements)
                .create(
                        eq(spaceId),
                        eq(circleId),
                        eq(adultId),
                        fpCaptor.capture(),
                        eq("America/New_York"),
                        eq(member.startsAt()),
                        any());
        assertThat(fpCaptor.getValue().dayOfWeek()).isEqualTo(DayOfWeek.TUESDAY);
    }

    @Test
    void acceptRejectsOwnCircle() {
        UUID arrangementId = UUID.randomUUID();
        when(arrangements.expireOpenIfDue(eq(spaceId), any())).thenReturn(0);
        when(arrangements.findBySpaceAndId(spaceId, arrangementId))
                .thenReturn(
                        Optional.of(
                                openDto(arrangementId, circleId)));

        assertThatThrownBy(() -> service.accept(adult, spaceId, arrangementId))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex -> assertThat(((CarpoolException) ex).status()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void endRejectsNonRequester() {
        UUID arrangementId = UUID.randomUUID();
        UUID otherCircle = UUID.randomUUID();
        when(arrangements.findBySpaceAndId(spaceId, arrangementId))
                .thenReturn(Optional.of(openDto(arrangementId, otherCircle)));

        assertThatThrownBy(() -> service.end(adult, spaceId, arrangementId))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex ->
                                assertThat(((CarpoolException) ex).status())
                                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    private StandingRideArrangementDto openDto(UUID arrangementId, UUID requestingCircle) {
        return new StandingRideArrangementDto(
                arrangementId,
                spaceId,
                requestingCircle,
                adultId,
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "field 3"),
                "America/New_York",
                Instant.parse("2026-10-06T21:00:00Z"),
                StandingRideAssignment.FIXED_PRIMARY,
                StandingRideArrangementStatus.OPEN,
                null,
                null,
                new StandingRideAskTemplateDto(List.of(), List.of()),
                Instant.now(),
                null);
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

    private static List<SaveCarpoolRidePlanLeg> bothAsked() {
        return List.of(
                new SaveCarpoolRidePlanLeg(
                        CarpoolLegKind.TO, CarpoolRidePlanLegAction.ASK_TEAM, null),
                new SaveCarpoolRidePlanLeg(
                        CarpoolLegKind.FROM, CarpoolRidePlanLegAction.ASK_TEAM, null));
    }
}
