package com.yourorg.quickapp.coverage.internal;

import com.yourorg.quickapp.coverage.CoverageApi;
import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.coverage.ScheduleIntervals;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class CoverageApiImpl implements CoverageApi {

    private static final Set<CoverageStatus> ACTIVE =
            Set.of(CoverageStatus.PENDING, CoverageStatus.CONFIRMED);

    private final FamilyMembershipApi membershipApi;
    private final ManualEventCalendarApi manualEventCalendarApi;
    private final FeedCalendarApi feedCalendarApi;
    private final CoverageAssignmentRepository assignments;

    CoverageApiImpl(
            FamilyMembershipApi membershipApi,
            ManualEventCalendarApi manualEventCalendarApi,
            FeedCalendarApi feedCalendarApi,
            CoverageAssignmentRepository assignments) {
        this.membershipApi = membershipApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.feedCalendarApi = feedCalendarApi;
        this.assignments = assignments;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CoverageAssignmentDto> listForItem(
            UUID circleId, CoverageItemSource source, UUID itemId) {
        return assignments
                .findByCircleIdAndItemSourceAndItemIdOrderByCreatedAtAsc(circleId, source, itemId)
                .stream()
                .map(CoverageApiImpl::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CoverageAssignmentDto> listForItems(
            UUID circleId, CoverageItemSource source, Collection<UUID> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) {
            return List.of();
        }
        return assignments
                .findByCircleIdAndItemSourceAndItemIdInOrderByCreatedAtAsc(
                        circleId, source, itemIds)
                .stream()
                .map(CoverageApiImpl::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CoverageAssignmentDto requireAssignment(UUID actorAdultId, UUID assignmentId) {
        UUID circleId = membershipApi.requireMemberCircleId(actorAdultId);
        return toDto(requireAssignmentInCircle(assignmentId, circleId));
    }

    @Override
    @Transactional
    public CoverageAssignmentDto assign(
            UUID actorAdultId,
            CoverageItemSource source,
            UUID itemId,
            UUID coveringAdultId,
            List<UUID> kidIds) {
        UUID circleId = membershipApi.requireMemberCircleId(actorAdultId);
        Set<UUID> kids = normalizeKidIds(kidIds);
        Set<UUID> itemKids = requireItemKidIds(circleId, source, itemId);
        validateKidsOnItem(kids, itemKids);
        membershipApi.requireKidsInCircle(circleId, kids);
        membershipApi.requireAdultInCircle(circleId, coveringAdultId);

        Instant now = Instant.now();
        CoverageStatus status =
                actorAdultId.equals(coveringAdultId)
                        ? CoverageStatus.CONFIRMED
                        : CoverageStatus.PENDING;

        var existingActive =
                assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        circleId, source, itemId, coveringAdultId, ACTIVE);
        if (existingActive.isPresent()) {
            CoverageAssignmentEntity row = existingActive.get();
            if (status == CoverageStatus.CONFIRMED) {
                assertNoConfirmedDoubleBook(circleId, coveringAdultId, source, itemId, row.id());
            }
            assertNoKidConflict(circleId, source, itemId, kids, row.id());
            row.reassign(coveringAdultId, actorAdultId, status, kids, now);
            return toDto(assignments.save(row));
        }

        if (status == CoverageStatus.CONFIRMED) {
            assertNoConfirmedDoubleBook(circleId, coveringAdultId, source, itemId, null);
        }
        assertNoKidConflict(circleId, source, itemId, kids, null);
        CoverageAssignmentEntity created =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        source,
                        itemId,
                        coveringAdultId,
                        actorAdultId,
                        status,
                        kids,
                        now,
                        now);
        return toDto(assignments.save(created));
    }

    @Override
    @Transactional
    public CoverageAssignmentDto reassign(
            UUID actorAdultId, UUID assignmentId, UUID coveringAdultId, List<UUID> kidIds) {
        UUID circleId = membershipApi.requireMemberCircleId(actorAdultId);
        CoverageAssignmentEntity row = requireAssignmentInCircle(assignmentId, circleId);
        Set<UUID> kids = normalizeKidIds(kidIds);
        Set<UUID> itemKids = requireItemKidIds(circleId, row.itemSource(), row.itemId());
        validateKidsOnItem(kids, itemKids);
        membershipApi.requireKidsInCircle(circleId, kids);
        membershipApi.requireAdultInCircle(circleId, coveringAdultId);

        assertNoKidConflict(circleId, row.itemSource(), row.itemId(), kids, row.id());

        Instant now = Instant.now();
        CoverageStatus status;
        if (actorAdultId.equals(coveringAdultId)) {
            status = CoverageStatus.CONFIRMED;
        } else if (!coveringAdultId.equals(row.coveringAdultId())) {
            status = CoverageStatus.PENDING;
        } else if (row.status() == CoverageStatus.DECLINED) {
            status = CoverageStatus.PENDING;
        } else {
            status = row.status();
        }

        if (status == CoverageStatus.CONFIRMED) {
            assertNoConfirmedDoubleBook(
                    circleId, coveringAdultId, row.itemSource(), row.itemId(), row.id());
        }

        row.reassign(coveringAdultId, actorAdultId, status, kids, now);
        return toDto(assignments.save(row));
    }

    @Override
    @Transactional
    public void remove(UUID actorAdultId, UUID assignmentId) {
        UUID circleId = membershipApi.requireMemberCircleId(actorAdultId);
        CoverageAssignmentEntity row = requireAssignmentInCircle(assignmentId, circleId);
        assignments.delete(row);
    }

    @Override
    @Transactional
    public CoverageAssignmentDto confirm(UUID actorAdultId, UUID assignmentId) {
        return respond(actorAdultId, assignmentId, CoverageStatus.CONFIRMED);
    }

    @Override
    @Transactional
    public CoverageAssignmentDto decline(UUID actorAdultId, UUID assignmentId) {
        return respond(actorAdultId, assignmentId, CoverageStatus.DECLINED);
    }

    private CoverageAssignmentDto respond(
            UUID actorAdultId, UUID assignmentId, CoverageStatus next) {
        UUID circleId = membershipApi.requireMemberCircleId(actorAdultId);
        CoverageAssignmentEntity row = requireAssignmentInCircle(assignmentId, circleId);
        if (!actorAdultId.equals(row.coveringAdultId())) {
            throw new FamilyAccessException(
                    HttpStatus.FORBIDDEN, "Only the assigned adult can confirm or decline");
        }
        if (row.status() != CoverageStatus.PENDING) {
            throw new FamilyAccessException(
                    HttpStatus.CONFLICT, "Assignment is not pending confirmation");
        }
        if (next == CoverageStatus.CONFIRMED) {
            assertNoConfirmedDoubleBook(
                    circleId, row.coveringAdultId(), row.itemSource(), row.itemId(), row.id());
        }
        row.setStatus(next, Instant.now());
        return toDto(assignments.save(row));
    }

    private void assertNoConfirmedDoubleBook(
            UUID circleId,
            UUID coveringAdultId,
            CoverageItemSource source,
            UUID itemId,
            UUID excludeAssignmentId) {
        Instant[] targetTimes =
                findItemTimes(circleId, source, itemId)
                        .orElseThrow(
                                () ->
                                        new FamilyAccessException(
                                                HttpStatus.NOT_FOUND, "Calendar item not found"));
        List<CoverageAssignmentEntity> confirmed =
                assignments.findByCircleIdAndCoveringAdultIdAndStatus(
                        circleId, coveringAdultId, CoverageStatus.CONFIRMED);
        for (CoverageAssignmentEntity other : confirmed) {
            if (excludeAssignmentId != null && other.id().equals(excludeAssignmentId)) {
                continue;
            }
            if (other.itemSource() == source && other.itemId().equals(itemId)) {
                continue;
            }
            // Skip stale rows whose calendar item was deleted (e.g. feed sync removed UID).
            Instant[] otherTimes =
                    findItemTimes(circleId, other.itemSource(), other.itemId()).orElse(null);
            if (otherTimes == null) {
                continue;
            }
            if (ScheduleIntervals.overlaps(
                    targetTimes[0], targetTimes[1], otherTimes[0], otherTimes[1])) {
                throw new FamilyAccessException(
                        HttpStatus.CONFLICT,
                        "Adult is already confirmed on an overlapping calendar item");
            }
        }
    }

    private Optional<Instant[]> findItemTimes(
            UUID circleId, CoverageItemSource source, UUID itemId) {
        return switch (source) {
            case MANUAL ->
                    manualEventCalendarApi
                            .findInCircle(circleId, itemId)
                            .map(event -> new Instant[] {event.startsAt(), event.endsAt()});
            case FEED ->
                    feedCalendarApi
                            .findEventInCircle(circleId, itemId)
                            .map(event -> new Instant[] {event.startsAt(), event.endsAt()});
        };
    }

    private CoverageAssignmentEntity requireAssignmentInCircle(UUID assignmentId, UUID circleId) {
        CoverageAssignmentEntity row =
                assignments
                        .findById(assignmentId)
                        .orElseThrow(
                                () ->
                                        new FamilyAccessException(
                                                HttpStatus.NOT_FOUND, "Coverage assignment not found"));
        if (!row.circleId().equals(circleId)) {
            throw new FamilyAccessException(HttpStatus.NOT_FOUND, "Coverage assignment not found");
        }
        return row;
    }

    private Set<UUID> requireItemKidIds(
            UUID circleId, CoverageItemSource source, UUID itemId) {
        List<UUID> kidIds =
                switch (source) {
                    case MANUAL ->
                            manualEventCalendarApi
                                    .findInCircle(circleId, itemId)
                                    .orElseThrow(
                                            () ->
                                                    new FamilyAccessException(
                                                            HttpStatus.NOT_FOUND,
                                                            "Calendar item not found"))
                                    .kidIds();
                    case FEED ->
                            feedCalendarApi
                                    .findEventInCircle(circleId, itemId)
                                    .orElseThrow(
                                            () ->
                                                    new FamilyAccessException(
                                                            HttpStatus.NOT_FOUND,
                                                            "Calendar item not found"))
                                    .kidIds();
                };
        if (kidIds == null || kidIds.isEmpty()) {
            throw new FamilyAccessException(
                    HttpStatus.BAD_REQUEST, "Calendar item has no kids to cover");
        }
        return new HashSet<>(kidIds);
    }

    private void assertNoKidConflict(
            UUID circleId,
            CoverageItemSource source,
            UUID itemId,
            Set<UUID> kidIds,
            UUID excludeAssignmentId) {
        List<CoverageAssignmentEntity> active =
                assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        circleId, source, itemId, ACTIVE);
        for (CoverageAssignmentEntity other : active) {
            if (excludeAssignmentId != null && other.id().equals(excludeAssignmentId)) {
                continue;
            }
            for (UUID kidId : kidIds) {
                if (other.kidIds().contains(kidId)) {
                    throw new FamilyAccessException(
                            HttpStatus.CONFLICT,
                            "Kid is already covered on this calendar item");
                }
            }
        }
    }

    private static Set<UUID> normalizeKidIds(List<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            throw new FamilyAccessException(HttpStatus.BAD_REQUEST, "kidIds must not be empty");
        }
        Set<UUID> unique = new HashSet<>();
        for (UUID kidId : kidIds) {
            if (kidId == null) {
                throw new FamilyAccessException(HttpStatus.BAD_REQUEST, "kidIds must not contain null");
            }
            unique.add(kidId);
        }
        return unique;
    }

    private static void validateKidsOnItem(Set<UUID> kids, Set<UUID> itemKids) {
        for (UUID kidId : kids) {
            if (!itemKids.contains(kidId)) {
                throw new FamilyAccessException(
                        HttpStatus.BAD_REQUEST, "Kid is not on this calendar item");
            }
        }
    }

    private static CoverageAssignmentDto toDto(CoverageAssignmentEntity entity) {
        return new CoverageAssignmentDto(
                entity.id(),
                entity.itemSource(),
                entity.itemId(),
                entity.coveringAdultId(),
                entity.assignedByAdultId(),
                entity.kidIds().stream().sorted().toList(),
                entity.status(),
                entity.createdAt(),
                entity.updatedAt());
    }
}
