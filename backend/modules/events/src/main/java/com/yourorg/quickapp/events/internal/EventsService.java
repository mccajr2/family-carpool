package com.yourorg.quickapp.events.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.events.CreateManualEventRequest;
import com.yourorg.quickapp.events.ManualEventKey;
import com.yourorg.quickapp.events.ManualEventResponse;
import com.yourorg.quickapp.events.ManualEventRideGuard;
import com.yourorg.quickapp.events.UpdateManualEventRequest;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedResponse;
import com.yourorg.quickapp.feeds.FeedsApi;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventsService {

    private final FamilyMembershipApi familyMembershipApi;
    private final FeedsApi feedsApi;
    private final ManualEventRideGuard rideGuard;
    private final ManualEventRepository events;

    public EventsService(
            FamilyMembershipApi familyMembershipApi,
            FeedsApi feedsApi,
            ManualEventRideGuard rideGuard,
            ManualEventRepository events) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedsApi = feedsApi;
        this.rideGuard = rideGuard;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<ManualEventResponse> list(AdultResponse adult) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return events.findByCircleIdOrderByStartsAtAscIdAsc(circleId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ManualEventResponse get(AdultResponse adult, UUID eventId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ManualEventEntity event =
                events.findByIdAndCircleId(eventId, circleId)
                        .orElseThrow(() -> new EventsException(HttpStatus.NOT_FOUND, "Event not found"));
        return toResponse(event);
    }

    @Transactional
    public ManualEventResponse create(AdultResponse adult, CreateManualEventRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        String title = normalizeRequired(request.title(), "title");
        Instant startsAt = requireStartsAt(request.startsAt());
        Instant endsAt = normalizeEndsAt(startsAt, request.endsAt());
        String location = normalizeOptional(request.location());
        FeedResponse linkedFeed = requireFeedInCircleOrNull(circleId, request.feedId());
        UUID feedId = linkedFeed == null ? null : linkedFeed.id();
        Set<UUID> kidIds = resolveKidIds(circleId, linkedFeed, request.kidIds());

        ManualEventEntity event =
                new ManualEventEntity(
                        UUID.randomUUID(), circleId, title, startsAt, endsAt, location, Instant.now());
        event.setKidIds(kidIds);
        event.setFeedId(feedId);
        events.save(event);
        return toResponse(event);
    }

    @Transactional
    public ManualEventResponse update(
            AdultResponse adult, UUID eventId, UpdateManualEventRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ManualEventEntity event =
                events.findByIdAndCircleId(eventId, circleId)
                        .orElseThrow(() -> new EventsException(HttpStatus.NOT_FOUND, "Event not found"));
        String title = normalizeRequired(request.title(), "title");
        Instant startsAt = requireStartsAt(request.startsAt());
        Instant endsAt = normalizeEndsAt(startsAt, request.endsAt());
        String location = normalizeOptional(request.location());
        FeedResponse linkedFeed = requireFeedInCircleOrNull(circleId, request.feedId());
        UUID feedId = linkedFeed == null ? null : linkedFeed.id();
        Set<UUID> kidIds = resolveKidIds(circleId, linkedFeed, request.kidIds());

        if (!Objects.equals(event.feedId(), feedId)) {
            rideGuard.requireNoActiveSpaceRides(circleId, ManualEventKey.of(event.id()));
        }

        event.setTitle(title);
        event.setStartsAt(startsAt);
        event.setEndsAt(endsAt);
        event.setLocation(location);
        event.setKidIds(kidIds);
        event.setFeedId(feedId);
        events.save(event);
        return toResponse(event);
    }

    @Transactional
    public void delete(AdultResponse adult, UUID eventId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ManualEventEntity event =
                events.findByIdAndCircleId(eventId, circleId)
                        .orElseThrow(() -> new EventsException(HttpStatus.NOT_FOUND, "Event not found"));
        if (event.feedId() != null) {
            rideGuard.cancelActivePlans(circleId, ManualEventKey.of(event.id()));
        }
        events.delete(event);
    }

    /**
     * Null {@code feedId} → standalone. Otherwise the feed must belong to this
     * circle.
     */
    private FeedResponse requireFeedInCircleOrNull(UUID circleId, UUID feedId) {
        if (feedId == null) {
            return null;
        }
        Optional<FeedResponse> feed =
                feedsApi.listByCircle(circleId).stream()
                        .filter(f -> feedId.equals(f.id()))
                        .findFirst();
        if (feed.isEmpty()) {
            throw new EventsException(HttpStatus.BAD_REQUEST, "feedId is not a feed in this circle");
        }
        return feed.get();
    }

    /**
     * Standalone: client {@code kidIds} (1+). Linked: feed roster (client list
     * ignored); empty feed roster → 400.
     */
    private Set<UUID> resolveKidIds(
            UUID circleId, FeedResponse linkedFeed, List<UUID> clientKidIds) {
        if (linkedFeed == null) {
            Set<UUID> kidIds = requireKidIds(clientKidIds);
            familyMembershipApi.requireKidsInCircle(circleId, kidIds);
            return kidIds;
        }
        List<UUID> roster = linkedFeed.kidIds();
        if (roster == null || roster.isEmpty()) {
            throw new EventsException(HttpStatus.BAD_REQUEST, "feed has no linked kids");
        }
        Set<UUID> kidIds = new HashSet<>(roster);
        familyMembershipApi.requireKidsInCircle(circleId, kidIds);
        return kidIds;
    }

    private ManualEventResponse toResponse(ManualEventEntity event) {
        return new ManualEventResponse(
                event.id(),
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                List.copyOf(event.kidIds()),
                event.feedId());
    }

    private static Instant requireStartsAt(Instant startsAt) {
        if (startsAt == null) {
            throw new EventsException(HttpStatus.BAD_REQUEST, "startsAt must not be null");
        }
        return startsAt;
    }

    private static Instant normalizeEndsAt(Instant startsAt, Instant endsAt) {
        if (endsAt == null) {
            return null;
        }
        if (endsAt.isBefore(startsAt)) {
            throw new EventsException(HttpStatus.BAD_REQUEST, "endsAt must be on or after startsAt");
        }
        return endsAt;
    }

    private static Set<UUID> requireKidIds(List<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            throw new EventsException(HttpStatus.BAD_REQUEST, "kidIds must not be empty");
        }
        return new HashSet<>(kidIds);
    }

    private static String normalizeRequired(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new EventsException(HttpStatus.BAD_REQUEST, field + " must not be blank");
        }
        return value.trim();
    }

    private static String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
