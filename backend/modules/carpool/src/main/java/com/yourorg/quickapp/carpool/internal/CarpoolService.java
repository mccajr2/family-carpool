package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.CarpoolFeedStatusKind;
import com.yourorg.quickapp.carpool.CarpoolFeedStatusResponse;
import com.yourorg.quickapp.carpool.CarpoolInviteResponse;
import com.yourorg.quickapp.carpool.CarpoolJoinRequestResponse;
import com.yourorg.quickapp.carpool.CarpoolSpaceMemberResponse;
import com.yourorg.quickapp.carpool.CarpoolSpaceMembership;
import com.yourorg.quickapp.carpool.CarpoolSpaceResponse;
import com.yourorg.quickapp.carpool.CarpoolSummaryResponse;
import com.yourorg.quickapp.carpool.EnableCarpoolSpaceRequest;
import com.yourorg.quickapp.carpool.JoinCarpoolSpaceRequest;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyRole;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CarpoolService {

    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AdultSessionApi adultSessionApi;
    private final FamilyMembershipApi familyMembershipApi;
    private final FeedsApi feedsApi;
    private final CarpoolSpaceRepository spaces;
    private final CarpoolMembershipRepository memberships;
    private final CarpoolJoinRequestRepository requests;

    public CarpoolService(
            AdultSessionApi adultSessionApi,
            FamilyMembershipApi familyMembershipApi,
            FeedsApi feedsApi,
            CarpoolSpaceRepository spaces,
            CarpoolMembershipRepository memberships,
            CarpoolJoinRequestRepository requests) {
        this.adultSessionApi = adultSessionApi;
        this.familyMembershipApi = familyMembershipApi;
        this.feedsApi = feedsApi;
        this.spaces = spaces;
        this.memberships = memberships;
        this.requests = requests;
    }

    @Transactional(readOnly = true)
    public CarpoolSummaryResponse summary(AdultResponse adult) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        FamilyRole circleRole = familyMembershipApi.requireMemberRole(adult.id());
        List<FeedResponse> feeds = feedsApi.listByCircle(circleId);
        List<CarpoolMembershipEntity> circleMemberships =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId);
        Map<UUID, CarpoolJoinRequestEntity> pendingBySpaceId =
                requests.findByCircleId(circleId).stream()
                        .collect(
                                Collectors.toMap(
                                        CarpoolJoinRequestEntity::spaceId, Function.identity()));
        Map<String, CarpoolSpaceEntity> spacesByUrl = spacesByUrl(feeds);
        Map<UUID, CarpoolMembershipEntity> membershipBySpaceId =
                circleMemberships.stream()
                        .collect(
                                Collectors.toMap(
                                        CarpoolMembershipEntity::spaceId, Function.identity()));

        List<CarpoolFeedStatusResponse> feedStatuses =
                feeds.stream()
                        .map(
                                feed ->
                                        feedStatus(
                                                feed,
                                                spacesByUrl.get(feed.sourceUrl()),
                                                membershipBySpaceId,
                                                pendingBySpaceId))
                        .toList();
        List<CarpoolSpaceResponse> spaceDtos =
                circleMemberships.stream()
                        .map(
                                membership ->
                                        spaces.findById(membership.spaceId())
                                                .map(space -> toSpaceResponse(space, circleId))
                                                .orElse(null))
                        .filter(dto -> dto != null)
                        .toList();
        return new CarpoolSummaryResponse(circleRole, feedStatuses, spaceDtos);
    }

    @Transactional
    public CarpoolSpaceResponse enable(AdultResponse adult, EnableCarpoolSpaceRequest request) {
        UUID circleId = familyMembershipApi.requireOrganizerCircleId(adult.id());
        UUID feedId = request.feedId();
        FeedResponse feed =
                feedsApi.listByCircle(circleId).stream()
                        .filter(row -> row.id().equals(feedId))
                        .findFirst()
                        .orElseThrow(() -> new CarpoolException(HttpStatus.NOT_FOUND, "Feed not found"));
        if (spaces.findByNormalizedSourceUrl(feed.sourceUrl()).isPresent()) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "A space already exists for this feed's normalized URL");
        }
        Instant now = Instant.now();
        CarpoolSpaceEntity space =
                new CarpoolSpaceEntity(
                        UUID.randomUUID(),
                        feed.name(),
                        feed.sourceUrl(),
                        generateUniqueInviteCode(),
                        now);
        spaces.save(space);
        memberships.save(
                new CarpoolMembershipEntity(
                        UUID.randomUUID(),
                        space.id(),
                        circleId,
                        CarpoolSpaceMembership.OWNER,
                        now));
        return toSpaceResponse(space, circleId);
    }

    @Transactional
    public CarpoolSpaceResponse join(AdultResponse adult, JoinCarpoolSpaceRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        String code = normalizeInviteCode(request.code());
        CarpoolSpaceEntity space =
                spaces.findByInviteCode(code)
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.NOT_FOUND,
                                                "Invite code unknown or no longer valid"));
        if (memberships.findBySpaceIdAndCircleId(space.id(), circleId).isPresent()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Already a member of this space");
        }
        feedsApi.ensureFeed(circleId, space.normalizedSourceUrl(), space.name());
        memberships.save(
                new CarpoolMembershipEntity(
                        UUID.randomUUID(),
                        space.id(),
                        circleId,
                        CarpoolSpaceMembership.MEMBER,
                        Instant.now()));
        requests.findBySpaceIdAndCircleId(space.id(), circleId).ifPresent(requests::delete);
        return toSpaceResponse(space, circleId);
    }

    @Transactional(readOnly = true)
    public CarpoolSpaceResponse getSpace(AdultResponse adult, UUID spaceId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        return toSpaceResponse(space, circleId);
    }

    @Transactional
    public CarpoolInviteResponse regenerateInvite(AdultResponse adult, UUID spaceId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        requireOwner(spaceId, circleId);
        space.setInviteCode(generateUniqueInviteCode());
        spaces.save(space);
        return new CarpoolInviteResponse(space.inviteCode());
    }

    @Transactional
    public void leave(AdultResponse adult, UUID spaceId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        CarpoolMembershipEntity membership =
                memberships.findBySpaceIdAndCircleId(spaceId, circleId).orElseThrow(this::notFound);
        if (membership.membership() == CarpoolSpaceMembership.OWNER) {
            if (memberships.countBySpaceId(spaceId) > 1) {
                throw new CarpoolException(
                        HttpStatus.CONFLICT,
                        "Owner cannot leave while other member circles remain");
            }
            spaces.delete(space);
            return;
        }
        memberships.delete(membership);
        requests.findBySpaceIdAndCircleId(spaceId, circleId).ifPresent(requests::delete);
    }

    @Transactional
    public CarpoolJoinRequestResponse createRequest(AdultResponse adult, UUID spaceId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElseThrow(this::notFound);
        if (feedsApi.findByCircleAndNormalizedUrl(circleId, space.normalizedSourceUrl()).isEmpty()) {
            throw notFound();
        }
        if (memberships.findBySpaceIdAndCircleId(spaceId, circleId).isPresent()) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Already a member of this space");
        }
        if (requests.findBySpaceIdAndCircleId(spaceId, circleId).isPresent()) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "A pending request from this circle already exists");
        }
        CarpoolJoinRequestEntity created =
                new CarpoolJoinRequestEntity(
                        UUID.randomUUID(), spaceId, circleId, adult.id(), Instant.now());
        requests.save(created);
        return toJoinRequest(created);
    }

    @Transactional
    public CarpoolSpaceResponse admit(AdultResponse adult, UUID spaceId, UUID requestId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        requireOwner(spaceId, circleId);
        CarpoolJoinRequestEntity request =
                requests.findByIdAndSpaceId(requestId, spaceId).orElseThrow(this::notFound);
        UUID joiningCircleId = request.circleId();
        if (memberships.findBySpaceIdAndCircleId(spaceId, joiningCircleId).isEmpty()) {
            memberships.save(
                    new CarpoolMembershipEntity(
                            UUID.randomUUID(),
                            spaceId,
                            joiningCircleId,
                            CarpoolSpaceMembership.MEMBER,
                            Instant.now()));
        }
        requests.delete(request);
        return toSpaceResponse(space, circleId);
    }

    @Transactional
    public void decline(AdultResponse adult, UUID spaceId, UUID requestId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        requireOwner(spaceId, circleId);
        CarpoolJoinRequestEntity request =
                requests.findByIdAndSpaceId(requestId, spaceId).orElseThrow(this::notFound);
        requests.delete(request);
    }

    private CarpoolFeedStatusResponse feedStatus(
            FeedResponse feed,
            CarpoolSpaceEntity space,
            Map<UUID, CarpoolMembershipEntity> membershipBySpaceId,
            Map<UUID, CarpoolJoinRequestEntity> pendingBySpaceId) {
        if (space == null) {
            return new CarpoolFeedStatusResponse(
                    feed.id(), feed.name(), CarpoolFeedStatusKind.NONE, null, null);
        }
        CarpoolMembershipEntity membership = membershipBySpaceId.get(space.id());
        CarpoolFeedStatusKind kind;
        if (membership == null) {
            kind =
                    pendingBySpaceId.containsKey(space.id())
                            ? CarpoolFeedStatusKind.REQUESTED
                            : CarpoolFeedStatusKind.AVAILABLE;
        } else if (membership.membership() == CarpoolSpaceMembership.OWNER) {
            kind = CarpoolFeedStatusKind.OWNER;
        } else {
            kind = CarpoolFeedStatusKind.MEMBER;
        }
        return new CarpoolFeedStatusResponse(
                feed.id(), feed.name(), kind, space.id(), space.name());
    }

    private Map<String, CarpoolSpaceEntity> spacesByUrl(List<FeedResponse> feeds) {
        Set<String> urls =
                feeds.stream().map(FeedResponse::sourceUrl).collect(Collectors.toCollection(HashSet::new));
        if (urls.isEmpty()) {
            return Map.of();
        }
        Map<String, CarpoolSpaceEntity> byUrl = new HashMap<>();
        for (CarpoolSpaceEntity space : spaces.findByNormalizedSourceUrlIn(urls)) {
            byUrl.put(space.normalizedSourceUrl(), space);
        }
        return byUrl;
    }

    private CarpoolSpaceResponse toSpaceResponse(CarpoolSpaceEntity space, UUID callerCircleId) {
        CarpoolMembershipEntity callerMembership =
                memberships
                        .findBySpaceIdAndCircleId(space.id(), callerCircleId)
                        .orElseThrow(this::notFound);
        List<CarpoolMembershipEntity> all =
                memberships.findBySpaceIdOrderByCreatedAtAsc(space.id());
        Map<UUID, String> names =
                circleNames(all.stream().map(CarpoolMembershipEntity::circleId).toList());
        List<CarpoolSpaceMemberResponse> memberDtos =
                all.stream()
                        .map(
                                row ->
                                        new CarpoolSpaceMemberResponse(
                                                row.circleId(),
                                                names.get(row.circleId()),
                                                row.membership()))
                        .toList();
        List<CarpoolJoinRequestResponse> pending =
                callerMembership.membership() == CarpoolSpaceMembership.OWNER
                        ? requests.findBySpaceIdOrderByCreatedAtAsc(space.id()).stream()
                                .map(this::toJoinRequest)
                                .toList()
                        : List.of();
        UUID callerFeedId =
                feedsApi
                        .findByCircleAndNormalizedUrl(callerCircleId, space.normalizedSourceUrl())
                        .map(FeedResponse::id)
                        .orElse(null);
        return new CarpoolSpaceResponse(
                space.id(),
                space.name(),
                callerMembership.membership(),
                space.inviteCode(),
                callerFeedId,
                memberDtos,
                pending);
    }

    private CarpoolJoinRequestResponse toJoinRequest(CarpoolJoinRequestEntity request) {
        String circleName =
                familyMembershipApi
                        .findCircle(request.circleId())
                        .map(FamilyCircleName::name)
                        .orElse(null);
        String displayName = adultSessionApi.requireAdult(request.requestedByAdultId()).displayName();
        return new CarpoolJoinRequestResponse(
                request.id(),
                request.spaceId(),
                request.circleId(),
                circleName,
                request.requestedByAdultId(),
                displayName);
    }

    private Map<UUID, String> circleNames(Collection<UUID> circleIds) {
        Map<UUID, String> names = new HashMap<>();
        for (FamilyCircleName row : familyMembershipApi.findCircles(circleIds)) {
            names.put(row.id(), row.name());
        }
        return names;
    }

    private CarpoolSpaceEntity requireMemberSpace(UUID spaceId, UUID circleId) {
        CarpoolSpaceEntity space = spaces.findById(spaceId).orElseThrow(this::notFound);
        if (memberships.findBySpaceIdAndCircleId(spaceId, circleId).isEmpty()) {
            throw notFound();
        }
        return space;
    }

    private void requireOwner(UUID spaceId, UUID circleId) {
        CarpoolMembershipEntity membership =
                memberships.findBySpaceIdAndCircleId(spaceId, circleId).orElseThrow(this::notFound);
        if (membership.membership() != CarpoolSpaceMembership.OWNER) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Caller's circle is a member but not the owner");
        }
    }

    private CarpoolException notFound() {
        return new CarpoolException(HttpStatus.NOT_FOUND, "Space not found");
    }

    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < 32; attempt++) {
            String code = randomInviteCode();
            if (!spaces.existsByInviteCode(code)) {
                return code;
            }
        }
        throw new CarpoolException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate invite code");
    }

    private static String randomInviteCode() {
        StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            builder.append(INVITE_ALPHABET.charAt(RANDOM.nextInt(INVITE_ALPHABET.length())));
        }
        return builder.toString();
    }

    static String normalizeInviteCode(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "code must not be blank");
        }
        String normalized = raw.trim().toUpperCase();
        if (normalized.length() > 16) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "code is too long");
        }
        return normalized;
    }
}
