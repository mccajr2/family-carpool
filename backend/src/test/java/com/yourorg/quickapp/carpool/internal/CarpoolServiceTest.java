package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.CarpoolFeedStatusKind;
import com.yourorg.quickapp.carpool.CarpoolSpaceMembership;
import com.yourorg.quickapp.carpool.EnableCarpoolSpaceRequest;
import com.yourorg.quickapp.carpool.JoinCarpoolSpaceRequest;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyRole;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class CarpoolServiceTest {

    @Mock
    private AdultSessionApi adultSessionApi;

    @Mock
    private FamilyMembershipApi familyMembershipApi;

    @Mock
    private FeedsApi feedsApi;

    @Mock
    private CarpoolSpaceRepository spaces;

    @Mock
    private CarpoolMembershipRepository memberships;

    @Mock
    private CarpoolJoinRequestRepository requests;

    private CarpoolService service;

    private final UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000001");
    private final UUID circleId = UUID.fromString("01900000-0000-7000-8000-000000000010");
    private final UUID feedId = UUID.fromString("01900000-0000-7000-8000-000000000041");
    private final UUID spaceId = UUID.fromString("01900000-0000-7000-8000-000000000080");
    private final AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
    private final FeedResponse feed =
            new FeedResponse(
                    feedId,
                    "Soccer",
                    "https://example.com/team.ics",
                    List.of(),
                    Instant.parse("2026-08-01T00:00:00Z"),
                    null,
                    2);

    @BeforeEach
    void setUp() {
        service =
                new CarpoolService(
                        adultSessionApi, familyMembershipApi, feedsApi, spaces, memberships, requests);
    }

    @Test
    void enableCreatesOwnerSpace() {
        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feedsApi.listByCircle(circleId)).thenReturn(List.of(feed));
        when(spaces.findByNormalizedSourceUrl(feed.sourceUrl())).thenReturn(Optional.empty());
        when(spaces.existsByInviteCode(any())).thenReturn(false);
        when(spaces.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubSpaceDetailAfterWrite(CarpoolSpaceMembership.OWNER);

        var response = service.enable(adult, new EnableCarpoolSpaceRequest(feedId));

        assertThat(response.membership()).isEqualTo(CarpoolSpaceMembership.OWNER);
        assertThat(response.name()).isEqualTo("Soccer");
        assertThat(response.inviteCode()).hasSize(8);
        ArgumentCaptor<CarpoolMembershipEntity> saved =
                ArgumentCaptor.forClass(CarpoolMembershipEntity.class);
        verify(memberships).save(saved.capture());
        assertThat(saved.getValue().membership()).isEqualTo(CarpoolSpaceMembership.OWNER);
        assertThat(saved.getValue().circleId()).isEqualTo(circleId);
    }

    @Test
    void enableCaregiverForbidden() {
        when(familyMembershipApi.requireOrganizerCircleId(adultId))
                .thenThrow(new FamilyAccessException(HttpStatus.FORBIDDEN, "Organizer role required"));

        assertThatThrownBy(() -> service.enable(adult, new EnableCarpoolSpaceRequest(feedId)))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
        verify(spaces, never()).save(any());
    }

    @Test
    void enableDuplicateUrlConflict() {
        when(familyMembershipApi.requireOrganizerCircleId(adultId)).thenReturn(circleId);
        when(feedsApi.listByCircle(circleId)).thenReturn(List.of(feed));
        when(spaces.findByNormalizedSourceUrl(feed.sourceUrl()))
                .thenReturn(Optional.of(space("Soccer")));

        assertThatThrownBy(() -> service.enable(adult, new EnableCarpoolSpaceRequest(feedId)))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void joinAdmitsAndEnsureFeed() {
        CarpoolSpaceEntity space = space("Soccer");
        CarpoolMembershipEntity member = membership(CarpoolSpaceMembership.MEMBER);
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findByInviteCode("AB12CD34")).thenReturn(Optional.of(space));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(member));
        when(feedsApi.ensureFeed(circleId, space.normalizedSourceUrl(), space.name()))
                .thenReturn(feed);
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(requests.findBySpaceIdAndCircleId(spaceId, circleId)).thenReturn(Optional.empty());
        when(memberships.findBySpaceIdOrderByCreatedAtAsc(spaceId)).thenReturn(List.of(member));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House")));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, space.normalizedSourceUrl()))
                .thenReturn(Optional.of(feed));

        var response = service.join(adult, new JoinCarpoolSpaceRequest("ab12cd34"));

        assertThat(response.membership()).isEqualTo(CarpoolSpaceMembership.MEMBER);
        verify(feedsApi).ensureFeed(circleId, "https://example.com/team.ics", "Soccer");
        verify(memberships).save(any());
    }

    @Test
    void joinUnknownCode404() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findByInviteCode("DEADCODE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.join(adult, new JoinCarpoolSpaceRequest("DEADCODE")))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
        verify(feedsApi, never()).ensureFeed(any(), any(), any());
    }

    @Test
    void joinAlreadyMember409() {
        CarpoolSpaceEntity space = space("Soccer");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findByInviteCode("AB12CD34")).thenReturn(Optional.of(space));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(Optional.of(membership(CarpoolSpaceMembership.OWNER)));

        assertThatThrownBy(() -> service.join(adult, new JoinCarpoolSpaceRequest("AB12CD34")))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(feedsApi, never()).ensureFeed(any(), any(), any());
    }

    @Test
    void requestWithoutMatchingFeed404() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space("Soccer")));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createRequest(adult, spaceId))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void requestDuplicatePending409() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space("Soccer")));
        when(feedsApi.findByCircleAndNormalizedUrl(circleId, "https://example.com/team.ics"))
                .thenReturn(Optional.of(feed));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId)).thenReturn(Optional.empty());
        when(requests.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(
                        Optional.of(
                                new CarpoolJoinRequestEntity(
                                        UUID.randomUUID(), spaceId, circleId, adultId, Instant.now())));

        assertThatThrownBy(() -> service.createRequest(adult, spaceId))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void admitNonOwner403() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space("Soccer")));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(Optional.of(membership(CarpoolSpaceMembership.MEMBER)));

        assertThatThrownBy(() -> service.admit(adult, spaceId, UUID.randomUUID()))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void leaveOwnerWithOtherMembers409() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space("Soccer")));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(Optional.of(membership(CarpoolSpaceMembership.OWNER)));
        when(memberships.countBySpaceId(spaceId)).thenReturn(2L);

        assertThatThrownBy(() -> service.leave(adult, spaceId))
                .isInstanceOf(CarpoolException.class)
                .extracting(ex -> ((CarpoolException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(spaces, never()).delete(any());
    }

    @Test
    void leaveOwnerAsSoleMemberDeletesSpace() {
        CarpoolSpaceEntity space = space("Soccer");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(spaces.findById(spaceId)).thenReturn(Optional.of(space));
        when(memberships.findBySpaceIdAndCircleId(spaceId, circleId))
                .thenReturn(Optional.of(membership(CarpoolSpaceMembership.OWNER)));
        when(memberships.countBySpaceId(spaceId)).thenReturn(1L);

        service.leave(adult, spaceId);

        verify(spaces).delete(space);
    }

    @Test
    void summaryShowsAvailableWhenSpaceExistsButNotMember() {
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(familyMembershipApi.requireMemberRole(adultId)).thenReturn(FamilyRole.ORGANIZER);
        when(feedsApi.listByCircle(circleId)).thenReturn(List.of(feed));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());
        when(requests.findByCircleId(circleId)).thenReturn(List.of());
        when(spaces.findByNormalizedSourceUrlIn(any())).thenReturn(List.of(space("Soccer")));

        var summary = service.summary(adult);

        assertThat(summary.circleRole()).isEqualTo(FamilyRole.ORGANIZER);
        assertThat(summary.feeds()).hasSize(1);
        assertThat(summary.feeds().getFirst().status()).isEqualTo(CarpoolFeedStatusKind.AVAILABLE);
        assertThat(summary.feeds().getFirst().spaceName()).isEqualTo("Soccer");
        assertThat(summary.spaces()).isEmpty();
    }

    private void stubSpaceDetailAfterWrite(CarpoolSpaceMembership role) {
        when(memberships.findBySpaceIdAndCircleId(any(), eq(circleId)))
                .thenAnswer(
                        inv ->
                                Optional.of(
                                        new CarpoolMembershipEntity(
                                                UUID.randomUUID(),
                                                inv.getArgument(0),
                                                circleId,
                                                role,
                                                Instant.now())));
        when(memberships.findBySpaceIdOrderByCreatedAtAsc(any()))
                .thenAnswer(
                        inv ->
                                List.of(
                                        new CarpoolMembershipEntity(
                                                UUID.randomUUID(),
                                                inv.getArgument(0),
                                                circleId,
                                                role,
                                                Instant.now())));
        when(familyMembershipApi.findCircles(List.of(circleId)))
                .thenReturn(List.of(new FamilyCircleName(circleId, "House")));
        when(requests.findBySpaceIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
        when(feedsApi.findByCircleAndNormalizedUrl(eq(circleId), any())).thenReturn(Optional.of(feed));
    }

    private CarpoolSpaceEntity space(String name) {
        return new CarpoolSpaceEntity(
                spaceId, name, "https://example.com/team.ics", "AB12CD34", Instant.now());
    }

    private CarpoolMembershipEntity membership(CarpoolSpaceMembership role) {
        return new CarpoolMembershipEntity(UUID.randomUUID(), spaceId, circleId, role, Instant.now());
    }
}
