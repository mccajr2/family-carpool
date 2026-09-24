package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.StandingBlockMemberSnapshotDto;
import com.yourorg.quickapp.calendar.StandingBlockTemplateDto;
import com.yourorg.quickapp.calendar.StandingCoverageSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRouteOriginSnapshotDto;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists circle standing drive-block templates (Lock). Apply / Lock HTTP live
 * in later tasks; this service is the storage boundary.
 */
@Service
public class StandingBlockTemplateService {

    private final StandingBlockTemplateRepository repository;

    public StandingBlockTemplateService(StandingBlockTemplateRepository repository) {
        this.repository = repository;
    }

    /**
     * Inserts or replaces the template for {@code (circleId, ordered member
     * fingerprint set)}. Member order is significant and becomes the set key.
     */
    @Transactional
    public StandingBlockTemplateDto save(
            UUID circleId,
            UUID createdByAdultId,
            String timeZone,
            List<StandingBlockMemberSnapshotDto> members) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(createdByAdultId, "createdByAdultId");
        String zone = requireTimeZone(timeZone);
        List<StandingBlockMemberSnapshotDto> normalized = normalizeMembers(members);
        String setKey = fingerprintSetKey(normalized);
        Instant now = Instant.now();

        StandingBlockTemplateEntity entity =
                repository
                        .findByCircleIdAndFingerprintSetKey(circleId, setKey)
                        .orElse(null);
        if (entity == null) {
            entity =
                    new StandingBlockTemplateEntity(
                            UUID.randomUUID(), circleId, setKey, createdByAdultId, zone, now);
            entity.replaceMembers(toMemberEntities(normalized));
            return toDto(repository.save(entity));
        }
        // Clear + flush so orphan deletes land before re-insert (unique position/fp).
        entity.members().clear();
        repository.saveAndFlush(entity);
        entity.replaceMembers(toMemberEntities(normalized));
        return toDto(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<StandingBlockTemplateDto> listForCircle(UUID circleId) {
        Objects.requireNonNull(circleId, "circleId");
        return repository.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                .map(StandingBlockTemplateService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<StandingBlockTemplateDto> findByCircleAndFingerprints(
            UUID circleId, List<RecurringFeedFingerprint> orderedFingerprints) {
        Objects.requireNonNull(circleId, "circleId");
        if (orderedFingerprints == null || orderedFingerprints.isEmpty()) {
            return Optional.empty();
        }
        String setKey =
                orderedFingerprints.stream()
                        .map(RecurringFeedFingerprint::encoded)
                        .collect(Collectors.joining("\n"));
        return repository
                .findByCircleIdAndFingerprintSetKey(circleId, setKey)
                .map(StandingBlockTemplateService::toDto);
    }

    @Transactional(readOnly = true)
    public Optional<StandingBlockTemplateDto> findByCircleAndId(UUID circleId, UUID templateId) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(templateId, "templateId");
        return repository.findByIdAndCircleId(templateId, circleId).map(StandingBlockTemplateService::toDto);
    }

    /** Deletes by id within the circle. Returns true when a row was removed. */
    @Transactional
    public boolean delete(UUID circleId, UUID templateId) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(templateId, "templateId");
        return repository.deleteByIdAndCircleId(templateId, circleId) > 0;
    }

    /**
     * Deletes by ordered fingerprint set within the circle. Returns true when a
     * row was removed.
     */
    @Transactional
    public boolean deleteByFingerprints(
            UUID circleId, List<RecurringFeedFingerprint> orderedFingerprints) {
        Objects.requireNonNull(circleId, "circleId");
        if (orderedFingerprints == null || orderedFingerprints.isEmpty()) {
            return false;
        }
        String setKey =
                orderedFingerprints.stream()
                        .map(RecurringFeedFingerprint::encoded)
                        .collect(Collectors.joining("\n"));
        return repository.deleteByCircleIdAndFingerprintSetKey(circleId, setKey) > 0;
    }

    static String fingerprintSetKey(List<StandingBlockMemberSnapshotDto> members) {
        return members.stream()
                .map(m -> m.fingerprint().encoded())
                .collect(Collectors.joining("\n"));
    }

    private static List<StandingBlockMemberSnapshotDto> normalizeMembers(
            List<StandingBlockMemberSnapshotDto> members) {
        if (members == null || members.isEmpty()) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST, "standing template requires at least one FEED member");
        }
        List<StandingBlockMemberSnapshotDto> normalized = new ArrayList<>(members.size());
        for (int i = 0; i < members.size(); i++) {
            StandingBlockMemberSnapshotDto member = members.get(i);
            if (member == null || member.fingerprint() == null) {
                throw new CalendarException(
                        HttpStatus.BAD_REQUEST, "each member requires a fingerprint");
            }
            List<StandingCoverageSnapshotDto> coverages =
                    member.coverages() == null ? List.of() : List.copyOf(member.coverages());
            for (StandingCoverageSnapshotDto coverage : coverages) {
                requireActiveCoverage(coverage);
            }
            List<StandingRidePlanSnapshotDto> ridePlans =
                    member.ridePlans() == null ? List.of() : List.copyOf(member.ridePlans());
            List<StandingRouteOriginSnapshotDto> routeOrigins =
                    member.routeOrigins() == null
                            ? List.of()
                            : List.copyOf(member.routeOrigins());
            normalized.add(
                    new StandingBlockMemberSnapshotDto(
                            member.fingerprint(),
                            i,
                            coverages,
                            ridePlans,
                            routeOrigins));
        }
        return List.copyOf(normalized);
    }

    private static void requireActiveCoverage(StandingCoverageSnapshotDto coverage) {
        if (coverage == null
                || coverage.coveringAdultId() == null
                || coverage.assignedByAdultId() == null
                || coverage.status() == null
                || coverage.kidIds() == null
                || coverage.kidIds().isEmpty()) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST,
                    "coverage snapshot requires adult, status, and kidIds");
        }
        if (coverage.status() == CoverageStatus.DECLINED) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST, "coverage snapshot must be PENDING or CONFIRMED");
        }
        if (coverage.leaveFromPlaceId() != null
                && coverage.leaveFromAddress() != null
                && !coverage.leaveFromAddress().isBlank()) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST,
                    "coverage leaveFromPlaceId and leaveFromAddress are mutually exclusive");
        }
    }

    private static List<StandingBlockTemplateMemberEntity> toMemberEntities(
            List<StandingBlockMemberSnapshotDto> members) {
        List<StandingBlockTemplateMemberEntity> entities = new ArrayList<>(members.size());
        for (StandingBlockMemberSnapshotDto member : members) {
            RecurringFeedFingerprint fp = member.fingerprint();
            entities.add(
                    new StandingBlockTemplateMemberEntity(
                            UUID.randomUUID(),
                            member.position(),
                            fp.feedId(),
                            fp.dayOfWeek().name(),
                            fp.minuteOfDay(),
                            fp.normalizedLocation(),
                            fp.encoded(),
                            StandingBlockSnapshotJson.writeCoverages(member.coverages()),
                            StandingBlockSnapshotJson.writeRidePlans(member.ridePlans()),
                            StandingBlockSnapshotJson.writeRouteOrigins(member.routeOrigins())));
        }
        return entities;
    }

    private static StandingBlockTemplateDto toDto(StandingBlockTemplateEntity entity) {
        List<StandingBlockMemberSnapshotDto> members =
                entity.members().stream().map(StandingBlockTemplateService::toMemberDto).toList();
        return new StandingBlockTemplateDto(
                entity.id(),
                entity.circleId(),
                entity.createdByAdultId(),
                entity.timeZone(),
                entity.createdAt(),
                members);
    }

    private static String requireTimeZone(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "timeZone is required");
        }
        try {
            return ZoneId.of(timeZone.trim()).getId();
        } catch (Exception ex) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "timeZone is invalid");
        }
    }

    private static StandingBlockMemberSnapshotDto toMemberDto(
            StandingBlockTemplateMemberEntity entity) {
        RecurringFeedFingerprint fingerprint =
                new RecurringFeedFingerprint(
                        entity.feedId(),
                        DayOfWeek.valueOf(entity.dayOfWeek()),
                        entity.minuteOfDay(),
                        entity.normalizedLocation());
        return new StandingBlockMemberSnapshotDto(
                fingerprint,
                entity.position(),
                StandingBlockSnapshotJson.readCoverages(entity.coveragesJson()),
                StandingBlockSnapshotJson.readRidePlans(entity.ridePlansJson()),
                StandingBlockSnapshotJson.readRouteOrigins(entity.routeOriginsJson()));
    }
}
