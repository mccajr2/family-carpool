package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
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
import com.yourorg.quickapp.family.CirclePlaceDto;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.family.FamilyPlaceApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import com.yourorg.quickapp.feeds.ForwardRecurrenceGate;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-facing standing Ask: gated create, Accept, Pass, requester End, and
 * unanswered expire. Materialise onto weeks is a later task.
 */
@Service
public class StandingRideAskService {

    /** Same feed-backed horizon length as household Lock gate/apply. */
    public static final int KNOWN_SCHEDULE_DAYS = 400;

    private static final int FAMILY_PLACE_ADDRESS_MAX = 255;

    private final StandingRideArrangementService arrangements;
    private final StandingRideArrangementPassRepository passes;
    private final FamilyMembershipApi familyMembershipApi;
    private final FamilyPlaceApi familyPlaceApi;
    private final FeedsApi feedsApi;
    private final FeedCalendarApi feedCalendarApi;
    private final CarpoolSpaceRepository spaces;
    private final CarpoolMembershipRepository memberships;

    public StandingRideAskService(
            StandingRideArrangementService arrangements,
            StandingRideArrangementPassRepository passes,
            FamilyMembershipApi familyMembershipApi,
            FamilyPlaceApi familyPlaceApi,
            FeedsApi feedsApi,
            FeedCalendarApi feedCalendarApi,
            CarpoolSpaceRepository spaces,
            CarpoolMembershipRepository memberships) {
        this.arrangements = arrangements;
        this.passes = passes;
        this.familyMembershipApi = familyMembershipApi;
        this.familyPlaceApi = familyPlaceApi;
        this.feedsApi = feedsApi;
        this.feedCalendarApi = feedCalendarApi;
        this.spaces = spaces;
        this.memberships = memberships;
    }

    @Transactional
    public StandingRideArrangementResponse create(
            AdultResponse adult, UUID spaceId, CreateStandingRideArrangementRequest request) {
        Objects.requireNonNull(request, "request");
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        CarpoolSpaceEntity space = requireMemberSpace(spaceId, circleId);
        ZoneId zone = parseZone(request.timeZone());

        FeedCalendarEventDto event = requireSpaceFeedEvent(circleId, space, request.eventKey());
        Instant knownFrom = LocalDate.now(zone).atStartOfDay(zone).toInstant();
        Instant knownTo = knownFrom.plus(Duration.ofDays(KNOWN_SCHEDULE_DAYS));
        List<FeedCalendarEventDto> horizon =
                feedCalendarApi.listEventsInRange(circleId, knownFrom, knownTo);
        if (ForwardRecurrenceGate.countOtherMatches(event, horizon, zone, knownFrom, knownTo)
                < ForwardRecurrenceGate.MIN_OTHER_MATCHES) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT,
                    "Standing Ask requires at least 3 other upcoming matches for this series");
        }

        RecurringFeedFingerprint fingerprint = RecurringFeedFingerprint.of(event, zone);
        StandingRideAskTemplateDto askTemplate =
                buildAskTemplate(adult.id(), circleId, request.kidIds(), request.legs(), event);
        StandingRideArrangementDto created =
                arrangements.create(
                        spaceId,
                        circleId,
                        adult.id(),
                        fingerprint,
                        zone.getId(),
                        event.startsAt(),
                        askTemplate);
        return StandingRideArrangementResponse.from(created, false);
    }

    @Transactional
    public List<StandingRideArrangementResponse> list(AdultResponse adult, UUID spaceId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        arrangements.expireOpenIfDue(spaceId, Instant.now());
        List<StandingRideArrangementDto> rows = arrangements.listNonEndedForSpace(spaceId);
        return withPassFlags(rows, adult.id());
    }

    @Transactional
    public StandingRideArrangementResponse accept(
            AdultResponse adult, UUID spaceId, UUID arrangementId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        arrangements.expireOpenIfDue(spaceId, Instant.now());
        StandingRideArrangementDto found =
                arrangements
                        .findBySpaceAndId(spaceId, arrangementId)
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.NOT_FOUND, "Arrangement not found"));
        if (found.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Cannot accept your own circle's standing Ask");
        }
        if (found.status() != StandingRideArrangementStatus.OPEN) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Arrangement is not open for accept");
        }
        StandingRideArrangementDto activated =
                arrangements.activate(spaceId, arrangementId, adult.id(), circleId);
        passes.deleteByArrangementId(arrangementId);
        return StandingRideArrangementResponse.from(activated, false);
    }

    @Transactional
    public StandingRideArrangementResponse pass(
            AdultResponse adult, UUID spaceId, UUID arrangementId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        arrangements.expireOpenIfDue(spaceId, Instant.now());
        StandingRideArrangementDto found =
                arrangements
                        .findBySpaceAndId(spaceId, arrangementId)
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.NOT_FOUND, "Arrangement not found"));
        if (found.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "Cannot pass on your own circle's standing Ask");
        }
        if (found.status() != StandingRideArrangementStatus.OPEN) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Arrangement is not open for pass");
        }
        if (!passes.existsByArrangementIdAndAdultId(arrangementId, adult.id())) {
            passes.save(
                    new StandingRideArrangementPassEntity(
                            UUID.randomUUID(), arrangementId, adult.id(), Instant.now()));
        }
        return StandingRideArrangementResponse.from(found, true);
    }

    /** Requester-only End whole arrangement (driver End-whole is out of v1). */
    @Transactional
    public StandingRideArrangementResponse end(
            AdultResponse adult, UUID spaceId, UUID arrangementId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        requireMemberSpace(spaceId, circleId);
        StandingRideArrangementDto found =
                arrangements
                        .findBySpaceAndId(spaceId, arrangementId)
                        .orElseThrow(
                                () ->
                                        new CarpoolException(
                                                HttpStatus.NOT_FOUND, "Arrangement not found"));
        if (!found.requestingCircleId().equals(circleId)) {
            throw new CarpoolException(
                    HttpStatus.FORBIDDEN, "Only the requesting circle can end standing");
        }
        if (found.status() == StandingRideArrangementStatus.ENDED) {
            return StandingRideArrangementResponse.from(found, false);
        }
        StandingRideArrangementDto ended = arrangements.end(spaceId, arrangementId);
        passes.deleteByArrangementId(arrangementId);
        return StandingRideArrangementResponse.from(ended, false);
    }

    /**
     * Calendar enrich path: expire unanswered OPEN arrangements for every space
     * this circle belongs to.
     */
    @Transactional
    public int expireOpenForCircle(UUID circleId, Instant now) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(now, "now");
        int total = 0;
        for (CarpoolMembershipEntity membership :
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId)) {
            total += arrangements.expireOpenIfDue(membership.spaceId(), now);
        }
        return total;
    }

    private List<StandingRideArrangementResponse> withPassFlags(
            List<StandingRideArrangementDto> rows, UUID adultId) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Set<UUID> passed = new HashSet<>();
        for (StandingRideArrangementPassEntity pass :
                passes.findByArrangementIdIn(
                        rows.stream().map(StandingRideArrangementDto::id).toList())) {
            if (adultId.equals(pass.adultId())) {
                passed.add(pass.arrangementId());
            }
        }
        List<StandingRideArrangementResponse> out = new ArrayList<>(rows.size());
        for (StandingRideArrangementDto row : rows) {
            out.add(StandingRideArrangementResponse.from(row, passed.contains(row.id())));
        }
        return out;
    }

    private StandingRideAskTemplateDto buildAskTemplate(
            UUID adultId,
            UUID circleId,
            List<UUID> requestedKidIds,
            List<SaveCarpoolRidePlanLeg> legs,
            FeedCalendarEventDto event) {
        List<UUID> kidIds = resolveKids(circleId, requestedKidIds, event);
        List<FamilyKidName> names = familyMembershipApi.findKids(circleId, kidIds);
        if (names.size() != kidIds.size()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "Kid not found in this circle");
        }
        Map<UUID, String> byId =
                names.stream().collect(Collectors.toMap(FamilyKidName::id, FamilyKidName::displayName));
        List<StandingRideAskKidDto> kids = new ArrayList<>(kidIds.size());
        for (UUID kidId : kidIds) {
            kids.add(new StandingRideAskKidDto(kidId, byId.get(kidId)));
        }

        StandingRideAskLegDto to = null;
        StandingRideAskLegDto from = null;
        for (SaveCarpoolRidePlanLeg leg : legs) {
            StandingRideAskLegDto normalized = normalizeAskLeg(adultId, leg);
            if (normalized.kind() == CarpoolLegKind.TO) {
                to = normalized;
            } else {
                from = normalized;
            }
        }
        if (to == null || from == null) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "legs must include TO and FROM");
        }
        return new StandingRideAskTemplateDto(kids, List.of(to, from));
    }

    private StandingRideAskLegDto normalizeAskLeg(UUID adultId, SaveCarpoolRidePlanLeg leg) {
        if (leg == null || leg.kind() == null || leg.action() == null) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "each leg requires kind and action");
        }
        CarpoolLegPhase phase;
        if (leg.action() == CarpoolRidePlanLegAction.ASK_TEAM) {
            phase = CarpoolLegPhase.ASKED_TEAM;
        } else if (leg.action() == CarpoolRidePlanLegAction.NEEDS_RIDE) {
            phase = CarpoolLegPhase.NEEDS_RIDE;
        } else {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "standing Ask legs must be ASK_TEAM or NEEDS_RIDE");
        }
        CarpoolMeetSide meetSide =
                leg.meetSide() == null ? CarpoolMeetSide.REQUESTER : leg.meetSide();
        if (phase == CarpoolLegPhase.NEEDS_RIDE) {
            if (leg.placeId() != null || hasText(leg.placeAddress()) || leg.meetSide() != null) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST,
                        "NEEDS_RIDE legs must omit place fields and meetSide");
            }
            return new StandingRideAskLegDto(
                    leg.kind(), phase, null, null, null, null, CarpoolMeetSide.REQUESTER);
        }
        if (meetSide == CarpoolMeetSide.ACCEPTOR) {
            if (leg.placeId() != null || hasText(leg.placeAddress())) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST,
                        "ACCEPTOR meetSide must omit place fields (bound on Accept)");
            }
            return new StandingRideAskLegDto(
                    leg.kind(),
                    phase,
                    null,
                    null,
                    "Driver's place",
                    "",
                    CarpoolMeetSide.ACCEPTOR);
        }
        ResolvedPlace place = resolveFamilyPlace(adultId, leg.placeId(), leg.placeAddress());
        if (place == null || !hasText(place.displayAddress())) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "No pickup address; add a home address in Places");
        }
        return new StandingRideAskLegDto(
                leg.kind(),
                phase,
                place.storedPlaceId(),
                place.storedOneTimeAddress(),
                place.displayName(),
                place.displayAddress(),
                CarpoolMeetSide.REQUESTER);
    }

    private List<UUID> resolveKids(
            UUID circleId, List<UUID> requested, FeedCalendarEventDto event) {
        if (requested != null && !requested.isEmpty()) {
            return List.copyOf(requested);
        }
        // Default: feed-linked kids (RSVP filtering lives on one-off create; standing
        // create accepts the feed roster when kidIds omitted).
        if (event.kidIds() == null || event.kidIds().isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "kidIds are required");
        }
        return List.copyOf(event.kidIds());
    }

    private FeedCalendarEventDto requireSpaceFeedEvent(
            UUID circleId, CarpoolSpaceEntity space, String eventKey) {
        if (eventKey == null || eventKey.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "eventKey is required");
        }
        Optional<FeedResponse> feed =
                feedsApi.findByCircleAndNormalizedUrl(circleId, space.normalizedSourceUrl());
        if (feed.isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "Unknown event");
        }
        UUID feedId = feed.get().id();
        Instant lookupFrom = Instant.parse("2000-01-01T00:00:00Z");
        Instant lookupTo = Instant.parse("2100-01-01T00:00:00Z");
        for (FeedCalendarEventDto event :
                feedCalendarApi.listEventsInRange(circleId, lookupFrom, lookupTo)) {
            if (feedId.equals(event.feedId()) && eventKey.equals(FeedEventKey.of(event))) {
                return event;
            }
        }
        throw new CarpoolException(HttpStatus.BAD_REQUEST, "Unknown event");
    }

    private ResolvedPlace resolveFamilyPlace(UUID adultId, UUID placeId, String placeAddress) {
        String trimmed = placeAddress == null ? null : placeAddress.trim();
        if (trimmed != null && trimmed.isEmpty()) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "placeAddress must be non-empty when set");
        }
        if (placeId != null && trimmed != null) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "placeId and placeAddress are mutually exclusive");
        }
        if (trimmed != null && trimmed.length() > FAMILY_PLACE_ADDRESS_MAX) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST,
                    "placeAddress must be at most " + FAMILY_PLACE_ADDRESS_MAX + " characters");
        }
        if (placeId != null) {
            CirclePlaceDto place;
            try {
                place = familyPlaceApi.requireLocatedPlaceForMember(adultId, placeId);
            } catch (com.yourorg.quickapp.family.FamilyAccessException ex) {
                throw new CarpoolException(ex.status(), ex.getMessage());
            }
            if (!hasText(place.address())) {
                throw new CarpoolException(
                        HttpStatus.BAD_REQUEST, "Place has no address; pick another");
            }
            return new ResolvedPlace(place.id(), null, place.name(), place.address());
        }
        if (trimmed != null) {
            return new ResolvedPlace(null, trimmed, trimmed, trimmed);
        }
        Optional<CirclePlaceDto> membershipDefault =
                familyPlaceApi.findDefaultLeaveFromForMember(adultId);
        if (membershipDefault.isPresent() && hasText(membershipDefault.get().address())) {
            CirclePlaceDto place = membershipDefault.get();
            return new ResolvedPlace(null, null, place.name(), place.address());
        }
        return familyPlaceApi.listLocatedPlacesForMember(adultId).stream()
                .filter(place -> hasText(place.address()))
                .findFirst()
                .map(place -> new ResolvedPlace(null, null, place.name(), place.address()))
                .orElse(null);
    }

    private CarpoolSpaceEntity requireMemberSpace(UUID spaceId, UUID circleId) {
        CarpoolSpaceEntity space =
                spaces.findById(spaceId)
                        .orElseThrow(
                                () -> new CarpoolException(HttpStatus.NOT_FOUND, "Space not found"));
        if (memberships.findBySpaceIdAndCircleId(spaceId, circleId).isEmpty()) {
            throw new CarpoolException(HttpStatus.NOT_FOUND, "Space not found");
        }
        return space;
    }

    private static ZoneId parseZone(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "timeZone is required");
        }
        try {
            return ZoneId.of(timeZone.trim());
        } catch (Exception ex) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "timeZone is invalid");
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record ResolvedPlace(
            UUID storedPlaceId,
            String storedOneTimeAddress,
            String displayName,
            String displayAddress) {}
}
