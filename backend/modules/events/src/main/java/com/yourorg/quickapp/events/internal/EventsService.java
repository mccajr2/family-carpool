package com.yourorg.quickapp.events.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.events.CreateManualEventRequest;
import com.yourorg.quickapp.events.ManualEventResponse;
import com.yourorg.quickapp.events.UpdateManualEventRequest;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventsService {

    private final FamilyMembershipApi familyMembershipApi;
    private final ManualEventRepository events;

    public EventsService(FamilyMembershipApi familyMembershipApi, ManualEventRepository events) {
        this.familyMembershipApi = familyMembershipApi;
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
        Set<UUID> kidIds = requireKidIds(request.kidIds());
        familyMembershipApi.requireKidsInCircle(circleId, kidIds);

        ManualEventEntity event =
                new ManualEventEntity(
                        UUID.randomUUID(), circleId, title, startsAt, endsAt, location, Instant.now());
        event.setKidIds(kidIds);
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
        Set<UUID> kidIds = requireKidIds(request.kidIds());
        familyMembershipApi.requireKidsInCircle(circleId, kidIds);

        event.setTitle(title);
        event.setStartsAt(startsAt);
        event.setEndsAt(endsAt);
        event.setLocation(location);
        event.setKidIds(kidIds);
        events.save(event);
        return toResponse(event);
    }

    @Transactional
    public void delete(AdultResponse adult, UUID eventId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        ManualEventEntity event =
                events.findByIdAndCircleId(eventId, circleId)
                        .orElseThrow(() -> new EventsException(HttpStatus.NOT_FOUND, "Event not found"));
        events.delete(event);
    }

    private ManualEventResponse toResponse(ManualEventEntity event) {
        return new ManualEventResponse(
                event.id(),
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                List.copyOf(event.kidIds()));
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
