package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.AssignCalendarCoverageRequest;
import com.yourorg.quickapp.calendar.CalendarConflictResponse;
import com.yourorg.quickapp.calendar.CalendarCoverageAssignmentResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.coverage.ScheduleIntervals;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CalendarService {

    private final FamilyMembershipApi familyMembershipApi;
    private final FeedCalendarApi feedCalendarApi;
    private final ManualEventCalendarApi manualEventCalendarApi;
    private final LeaveByApi leaveByApi;
    private final CoverageApi coverageApi;
    private final AdultSessionApi adultSessionApi;

    public CalendarService(
            FamilyMembershipApi familyMembershipApi,
            FeedCalendarApi feedCalendarApi,
            ManualEventCalendarApi manualEventCalendarApi,
            LeaveByApi leaveByApi,
            CoverageApi coverageApi,
            AdultSessionApi adultSessionApi) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedCalendarApi = feedCalendarApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.leaveByApi = leaveByApi;
        this.coverageApi = coverageApi;
        this.adultSessionApi = adultSessionApi;
    }

    public List<CalendarItemResponse> list(AdultResponse adult, Instant from, Instant to) {
        requireValidRange(from, to);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());

        List<FeedCalendarEventDto> feedEvents =
                feedCalendarApi.listEventsInRange(circleId, from, to);
        List<ManualCalendarEventDto> manualEvents =
                manualEventCalendarApi.listInRange(circleId, from, to);

        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> detection =
                buildDetectionSet(circleId, feedEvents, manualEvents);
        Map<CalendarConflictDetector.ItemKey, List<CalendarConflictResponse>> conflictsByItem =
                CalendarConflictDetector.detect(
                        List.copyOf(detection.values()), adultNamesFor(detection.values()));

        Map<UUID, List<CoverageAssignmentDto>> feedCoverages =
                groupCoverages(
                        coverageApi.listForItems(
                                circleId,
                                CoverageItemSource.FEED,
                                feedEvents.stream().map(FeedCalendarEventDto::id).toList()));
        Map<UUID, List<CoverageAssignmentDto>> manualCoverages =
                groupCoverages(
                        coverageApi.listForItems(
                                circleId,
                                CoverageItemSource.MANUAL,
                                manualEvents.stream().map(ManualCalendarEventDto::id).toList()));

        Map<UUID, String> adultNames = displayNamesFor(feedCoverages, manualCoverages);

        List<CalendarItemResponse> items = new ArrayList<>();
        for (FeedCalendarEventDto feedEvent : feedEvents) {
            items.add(
                    fromFeed(
                            adult.id(),
                            feedEvent,
                            feedCoverages.getOrDefault(feedEvent.id(), List.of()),
                            adultNames,
                            conflictsByItem.getOrDefault(
                                    new CalendarConflictDetector.ItemKey(
                                            CalendarItemSource.FEED, feedEvent.id()),
                                    List.of())));
        }
        for (ManualCalendarEventDto manual : manualEvents) {
            items.add(
                    fromManual(
                            adult.id(),
                            manual,
                            manualCoverages.getOrDefault(manual.id(), List.of()),
                            adultNames,
                            conflictsByItem.getOrDefault(
                                    new CalendarConflictDetector.ItemKey(
                                            CalendarItemSource.MANUAL, manual.id()),
                                    List.of())));
        }

        items.sort(
                Comparator.comparing(CalendarItemResponse::startsAt)
                        .thenComparing(item -> item.source().name())
                        .thenComparing(CalendarItemResponse::id));
        return List.copyOf(items);
    }

    public CalendarItemResponse setLeaveFrom(
            AdultResponse adult, CalendarItemSource source, UUID itemId, UUID placeId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        leaveByApi.setLeaveFrom(adult.id(), toLeaveBySource(source), itemId, placeId);
        return requireItem(adult.id(), circleId, source, itemId);
    }

    public CalendarItemResponse assignCoverage(
            AdultResponse adult,
            CalendarItemSource source,
            UUID itemId,
            AssignCalendarCoverageRequest request) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        coverageApi.assign(
                adult.id(),
                toCoverageSource(source),
                itemId,
                request.coveringAdultId(),
                request.kidIds());
        return requireItem(adult.id(), circleId, source, itemId);
    }

    public CalendarItemResponse reassignCoverage(
            AdultResponse adult, UUID assignmentId, AssignCalendarCoverageRequest request) {
        CoverageAssignmentDto updated =
                coverageApi.reassign(
                        adult.id(),
                        assignmentId,
                        request.coveringAdultId(),
                        request.kidIds());
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(
                adult.id(),
                circleId,
                toCalendarSource(updated.itemSource()),
                updated.itemId());
    }

    public CalendarItemResponse removeCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto existing = coverageApi.requireAssignment(adult.id(), assignmentId);
        coverageApi.remove(adult.id(), assignmentId);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(
                adult.id(),
                circleId,
                toCalendarSource(existing.itemSource()),
                existing.itemId());
    }

    public CalendarItemResponse confirmCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto updated = coverageApi.confirm(adult.id(), assignmentId);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(
                adult.id(),
                circleId,
                toCalendarSource(updated.itemSource()),
                updated.itemId());
    }

    public CalendarItemResponse declineCoverage(AdultResponse adult, UUID assignmentId) {
        CoverageAssignmentDto updated = coverageApi.decline(adult.id(), assignmentId);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        return requireItem(
                adult.id(),
                circleId,
                toCalendarSource(updated.itemSource()),
                updated.itemId());
    }

    private static void requireValidRange(Instant from, Instant to) {
        if (from == null || to == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (!from.isBefore(to)) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from must be before to");
        }
    }

    private CalendarItemResponse requireItem(
            UUID adultId, UUID circleId, CalendarItemSource source, UUID itemId) {
        return switch (source) {
            case MANUAL -> {
                ManualCalendarEventDto event =
                        manualEventCalendarApi
                                .findInCircle(circleId, itemId)
                                .orElseThrow(
                                        () ->
                                                new CalendarException(
                                                        HttpStatus.NOT_FOUND,
                                                        "Calendar item not found"));
                yield enrichSingle(adultId, circleId, event, null);
            }
            case FEED -> {
                FeedCalendarEventDto event =
                        feedCalendarApi
                                .findEventInCircle(circleId, itemId)
                                .orElseThrow(
                                        () ->
                                                new CalendarException(
                                                        HttpStatus.NOT_FOUND,
                                                        "Calendar item not found"));
                yield enrichSingle(adultId, circleId, null, event);
            }
        };
    }

    private CalendarItemResponse enrichSingle(
            UUID adultId,
            UUID circleId,
            ManualCalendarEventDto manual,
            FeedCalendarEventDto feed) {
        List<FeedCalendarEventDto> feedSeed =
                feed == null ? List.of() : List.of(feed);
        List<ManualCalendarEventDto> manualSeed =
                manual == null ? List.of() : List.of(manual);
        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> detection =
                buildDetectionSet(circleId, feedSeed, manualSeed);
        Map<CalendarConflictDetector.ItemKey, List<CalendarConflictResponse>> conflictsByItem =
                CalendarConflictDetector.detect(
                        List.copyOf(detection.values()), adultNamesFor(detection.values()));

        if (manual != null) {
            List<CoverageAssignmentDto> coverages =
                    coverageApi.listForItem(circleId, CoverageItemSource.MANUAL, manual.id());
            return fromManual(
                    adultId,
                    manual,
                    coverages,
                    displayNames(coverages),
                    conflictsByItem.getOrDefault(
                            new CalendarConflictDetector.ItemKey(
                                    CalendarItemSource.MANUAL, manual.id()),
                            List.of()));
        }
        List<CoverageAssignmentDto> coverages =
                coverageApi.listForItem(circleId, CoverageItemSource.FEED, feed.id());
        return fromFeed(
                adultId,
                feed,
                coverages,
                displayNames(coverages),
                conflictsByItem.getOrDefault(
                        new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, feed.id()),
                        List.of()));
    }

    private Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem>
            buildDetectionSet(
                    UUID circleId,
                    List<FeedCalendarEventDto> feedInPage,
                    List<ManualCalendarEventDto> manualInPage) {
        Instant windowStart = null;
        Instant windowEnd = null;
        for (FeedCalendarEventDto event : feedInPage) {
            windowStart = minStart(windowStart, event.startsAt());
            windowEnd = maxEnd(windowEnd, event.startsAt(), event.endsAt());
        }
        for (ManualCalendarEventDto event : manualInPage) {
            windowStart = minStart(windowStart, event.startsAt());
            windowEnd = maxEnd(windowEnd, event.startsAt(), event.endsAt());
        }

        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> byKey =
                new LinkedHashMap<>();
        for (FeedCalendarEventDto event : feedInPage) {
            byKey.put(
                    new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, event.id()),
                    toScheduleItem(event, List.of()));
        }
        for (ManualCalendarEventDto event : manualInPage) {
            byKey.put(
                    new CalendarConflictDetector.ItemKey(CalendarItemSource.MANUAL, event.id()),
                    toScheduleItem(event, List.of()));
        }

        if (windowStart != null && windowEnd != null) {
            for (FeedCalendarEventDto event :
                    feedCalendarApi.listEventsOverlapping(circleId, windowStart, windowEnd)) {
                byKey.putIfAbsent(
                        new CalendarConflictDetector.ItemKey(CalendarItemSource.FEED, event.id()),
                        toScheduleItem(event, List.of()));
            }
            for (ManualCalendarEventDto event :
                    manualEventCalendarApi.listOverlapping(circleId, windowStart, windowEnd)) {
                byKey.putIfAbsent(
                        new CalendarConflictDetector.ItemKey(
                                CalendarItemSource.MANUAL, event.id()),
                        toScheduleItem(event, List.of()));
            }
        }

        List<UUID> feedIds =
                byKey.keySet().stream()
                        .filter(k -> k.source() == CalendarItemSource.FEED)
                        .map(CalendarConflictDetector.ItemKey::id)
                        .toList();
        List<UUID> manualIds =
                byKey.keySet().stream()
                        .filter(k -> k.source() == CalendarItemSource.MANUAL)
                        .map(CalendarConflictDetector.ItemKey::id)
                        .toList();

        Map<UUID, List<CoverageAssignmentDto>> feedCoverages =
                groupCoverages(
                        coverageApi.listForItems(circleId, CoverageItemSource.FEED, feedIds));
        Map<UUID, List<CoverageAssignmentDto>> manualCoverages =
                groupCoverages(
                        coverageApi.listForItems(circleId, CoverageItemSource.MANUAL, manualIds));

        Map<CalendarConflictDetector.ItemKey, CalendarConflictDetector.ScheduleItem> withCoverage =
                new LinkedHashMap<>();
        for (var entry : byKey.entrySet()) {
            CalendarConflictDetector.ScheduleItem base = entry.getValue();
            List<CoverageAssignmentDto> coverages =
                    base.source() == CalendarItemSource.FEED
                            ? feedCoverages.getOrDefault(base.id(), List.of())
                            : manualCoverages.getOrDefault(base.id(), List.of());
            withCoverage.put(entry.getKey(), toScheduleItem(base, activeCoverages(coverages)));
        }
        return withCoverage;
    }

    private static CalendarConflictDetector.ScheduleItem toScheduleItem(
            FeedCalendarEventDto event, List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.kidIds(),
                coverages);
    }

    private static CalendarConflictDetector.ScheduleItem toScheduleItem(
            ManualCalendarEventDto event, List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.kidIds(),
                coverages);
    }

    private static CalendarConflictDetector.ScheduleItem toScheduleItem(
            CalendarConflictDetector.ScheduleItem base,
            List<CalendarConflictDetector.ActiveCoverage> coverages) {
        return new CalendarConflictDetector.ScheduleItem(
                base.id(),
                base.source(),
                base.title(),
                base.startsAt(),
                base.endsAt(),
                base.kidIds(),
                coverages);
    }

    private static List<CalendarConflictDetector.ActiveCoverage> activeCoverages(
            List<CoverageAssignmentDto> coverages) {
        List<CalendarConflictDetector.ActiveCoverage> active = new ArrayList<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() == CoverageStatus.PENDING
                    || coverage.status() == CoverageStatus.CONFIRMED) {
                active.add(
                        new CalendarConflictDetector.ActiveCoverage(
                                coverage.coveringAdultId(), coverage.status()));
            }
        }
        return List.copyOf(active);
    }

    private Map<UUID, String> adultNamesFor(
            Iterable<CalendarConflictDetector.ScheduleItem> items) {
        Set<UUID> adultIds = new HashSet<>();
        for (CalendarConflictDetector.ScheduleItem item : items) {
            for (CalendarConflictDetector.ActiveCoverage coverage : item.activeCoverages()) {
                adultIds.add(coverage.adultId());
            }
        }
        return resolveDisplayNames(adultIds);
    }

    private static Instant minStart(Instant current, Instant startsAt) {
        if (current == null || startsAt.isBefore(current)) {
            return startsAt;
        }
        return current;
    }

    private static Instant maxEnd(Instant current, Instant startsAt, Instant endsAt) {
        Instant end = ScheduleIntervals.endExclusive(startsAt, endsAt);
        if (current == null || end.isAfter(current)) {
            return end;
        }
        return current;
    }

    private CalendarItemResponse fromFeed(
            UUID adultId,
            FeedCalendarEventDto event,
            List<CoverageAssignmentDto> coverages,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts) {
        LeaveByEnrichmentDto leaveBy =
                leaveByApi.enrich(
                        adultId,
                        LeaveByItemSource.FEED,
                        event.id(),
                        event.startsAt(),
                        event.location());
        return toResponse(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                event.feedId(),
                event.feedName(),
                leaveBy,
                coverages,
                adultNames,
                conflicts);
    }

    private CalendarItemResponse fromManual(
            UUID adultId,
            ManualCalendarEventDto event,
            List<CoverageAssignmentDto> coverages,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts) {
        LeaveByEnrichmentDto leaveBy =
                leaveByApi.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        event.id(),
                        event.startsAt(),
                        event.location());
        return toResponse(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                null,
                null,
                leaveBy,
                coverages,
                adultNames,
                conflicts);
    }

    private static CalendarItemResponse toResponse(
            UUID id,
            CalendarItemSource source,
            String title,
            Instant startsAt,
            Instant endsAt,
            String location,
            List<UUID> kidIds,
            UUID feedId,
            String feedName,
            LeaveByEnrichmentDto leaveBy,
            List<CoverageAssignmentDto> coverages,
            Map<UUID, String> adultNames,
            List<CalendarConflictResponse> conflicts) {
        List<CalendarCoverageAssignmentResponse> coverageResponses =
                coverages.stream()
                        .map(
                                c ->
                                        new CalendarCoverageAssignmentResponse(
                                                c.id(),
                                                c.coveringAdultId(),
                                                adultNames.get(c.coveringAdultId()),
                                                c.assignedByAdultId(),
                                                c.kidIds(),
                                                c.status()))
                        .toList();
        return new CalendarItemResponse(
                id,
                source,
                title,
                startsAt,
                endsAt,
                location,
                kidIds,
                feedId,
                feedName,
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason(),
                coverageResponses,
                uncoveredKidIds(kidIds, coverages),
                conflicts == null ? List.of() : List.copyOf(conflicts));
    }

    static List<UUID> uncoveredKidIds(List<UUID> kidIds, List<CoverageAssignmentDto> coverages) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        Set<UUID> covered = new HashSet<>();
        for (CoverageAssignmentDto coverage : coverages) {
            if (coverage.status() == CoverageStatus.PENDING
                    || coverage.status() == CoverageStatus.CONFIRMED) {
                covered.addAll(coverage.kidIds());
            }
        }
        return kidIds.stream().filter(id -> !covered.contains(id)).toList();
    }

    private Map<UUID, String> displayNamesFor(
            Map<UUID, List<CoverageAssignmentDto>> feedCoverages,
            Map<UUID, List<CoverageAssignmentDto>> manualCoverages) {
        Set<UUID> adultIds = new HashSet<>();
        feedCoverages.values().forEach(list -> list.forEach(c -> adultIds.add(c.coveringAdultId())));
        manualCoverages
                .values()
                .forEach(list -> list.forEach(c -> adultIds.add(c.coveringAdultId())));
        return resolveDisplayNames(adultIds);
    }

    private Map<UUID, String> displayNames(List<CoverageAssignmentDto> coverages) {
        return resolveDisplayNames(
                coverages.stream()
                        .map(CoverageAssignmentDto::coveringAdultId)
                        .collect(Collectors.toSet()));
    }

    private Map<UUID, String> resolveDisplayNames(Set<UUID> adultIds) {
        Map<UUID, String> names = new HashMap<>();
        for (UUID adultId : adultIds) {
            AdultResponse adult = adultSessionApi.requireAdult(adultId);
            names.put(adultId, adult.displayName());
        }
        return names;
    }

    private static Map<UUID, List<CoverageAssignmentDto>> groupCoverages(
            List<CoverageAssignmentDto> coverages) {
        return coverages.stream().collect(Collectors.groupingBy(CoverageAssignmentDto::itemId));
    }

    private static LeaveByItemSource toLeaveBySource(CalendarItemSource source) {
        return switch (source) {
            case MANUAL -> LeaveByItemSource.MANUAL;
            case FEED -> LeaveByItemSource.FEED;
        };
    }

    private static CoverageItemSource toCoverageSource(CalendarItemSource source) {
        return switch (source) {
            case MANUAL -> CoverageItemSource.MANUAL;
            case FEED -> CoverageItemSource.FEED;
        };
    }

    private static CalendarItemSource toCalendarSource(CoverageItemSource source) {
        return switch (source) {
            case MANUAL -> CalendarItemSource.MANUAL;
            case FEED -> CalendarItemSource.FEED;
        };
    }
}
