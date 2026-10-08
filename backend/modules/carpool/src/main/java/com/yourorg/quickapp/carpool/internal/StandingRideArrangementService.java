package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.carpool.StandingRideArrangementDto;
import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import com.yourorg.quickapp.carpool.StandingRideAskKidDto;
import com.yourorg.quickapp.carpool.StandingRideAskLegDto;
import com.yourorg.quickapp.carpool.StandingRideAskTemplateDto;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists space-scoped standing ride arrangements (series Ask). Create /
 * activate / end / expire live here; Accept HTTP and materialise are
 * orchestrated by StandingRideAskService / StandingRideMaterialiseService.
 */
@Service
public class StandingRideArrangementService {

    private static final List<StandingRideArrangementStatus> NON_ENDED =
            List.of(StandingRideArrangementStatus.OPEN, StandingRideArrangementStatus.ACTIVE);

    private final StandingRideArrangementRepository repository;

    public StandingRideArrangementService(StandingRideArrangementRepository repository) {
        this.repository = repository;
    }

    /**
     * Inserts an {@code OPEN} {@code FIXED_PRIMARY} arrangement. Duplicate
     * non-{@code ENDED} for the same space + requesting circle + fingerprint →
     * 409.
     */
    @Transactional
    public StandingRideArrangementDto create(
            UUID spaceId,
            UUID requestingCircleId,
            UUID requestedByAdultId,
            RecurringFeedFingerprint fingerprint,
            String timeZone,
            Instant anchorStartsAt,
            StandingRideAskTemplateDto askTemplate) {
        Objects.requireNonNull(spaceId, "spaceId");
        Objects.requireNonNull(requestingCircleId, "requestingCircleId");
        Objects.requireNonNull(requestedByAdultId, "requestedByAdultId");
        Objects.requireNonNull(fingerprint, "fingerprint");
        Objects.requireNonNull(anchorStartsAt, "anchorStartsAt");
        String zone = requireTimeZone(timeZone);
        StandingRideAskTemplateDto normalized = normalizeAskTemplate(askTemplate);

        if (repository
                .findBySpaceIdAndRequestingCircleIdAndFingerprintEncodedAndStatusIn(
                        spaceId, requestingCircleId, fingerprint.encoded(), NON_ENDED)
                .isPresent()) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT,
                    "A standing ride arrangement already exists for this series");
        }

        StandingRideArrangementEntity entity =
                new StandingRideArrangementEntity(
                        UUID.randomUUID(),
                        spaceId,
                        requestingCircleId,
                        requestedByAdultId,
                        fingerprint.feedId(),
                        fingerprint.dayOfWeek().name(),
                        fingerprint.minuteOfDay(),
                        fingerprint.normalizedLocation(),
                        fingerprint.encoded(),
                        zone,
                        anchorStartsAt,
                        toKidEntities(normalized.kids()),
                        toLegEntities(normalized.legs()),
                        Instant.now());
        return toDto(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public Optional<StandingRideArrangementDto> findBySpaceAndId(UUID spaceId, UUID arrangementId) {
        Objects.requireNonNull(spaceId, "spaceId");
        Objects.requireNonNull(arrangementId, "arrangementId");
        return repository.findByIdAndSpaceId(arrangementId, spaceId).map(StandingRideArrangementService::toDto);
    }

    @Transactional(readOnly = true)
    public Optional<StandingRideArrangementDto> findNonEnded(
            UUID spaceId, UUID requestingCircleId, RecurringFeedFingerprint fingerprint) {
        Objects.requireNonNull(spaceId, "spaceId");
        Objects.requireNonNull(requestingCircleId, "requestingCircleId");
        Objects.requireNonNull(fingerprint, "fingerprint");
        return repository
                .findBySpaceIdAndRequestingCircleIdAndFingerprintEncodedAndStatusIn(
                        spaceId, requestingCircleId, fingerprint.encoded(), NON_ENDED)
                .map(StandingRideArrangementService::toDto);
    }

    @Transactional(readOnly = true)
    public List<StandingRideArrangementDto> listForSpace(UUID spaceId) {
        Objects.requireNonNull(spaceId, "spaceId");
        return repository.findBySpaceIdOrderByCreatedAtAsc(spaceId).stream()
                .map(StandingRideArrangementService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StandingRideArrangementDto> listNonEndedForSpace(UUID spaceId) {
        Objects.requireNonNull(spaceId, "spaceId");
        return repository.findBySpaceIdAndStatusInOrderByCreatedAtAsc(spaceId, NON_ENDED).stream()
                .map(StandingRideArrangementService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StandingRideArrangementDto> listOpenForSpace(UUID spaceId) {
        Objects.requireNonNull(spaceId, "spaceId");
        return repository
                .findBySpaceIdAndStatusInOrderByCreatedAtAsc(
                        spaceId, List.of(StandingRideArrangementStatus.OPEN))
                .stream()
                .map(StandingRideArrangementService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StandingRideArrangementDto> listActiveForSpace(UUID spaceId) {
        Objects.requireNonNull(spaceId, "spaceId");
        return repository
                .findBySpaceIdAndStatusInOrderByCreatedAtAsc(
                        spaceId, List.of(StandingRideArrangementStatus.ACTIVE))
                .stream()
                .map(StandingRideArrangementService::toDto)
                .toList();
    }

    /**
     * Ends still-{@code OPEN} arrangements whose anchor occurrence's local
     * calendar day has started ({@code now >= local midnight of anchor day}).
     * Returns how many were ended.
     */
    @Transactional
    public int expireOpenIfDue(UUID spaceId, Instant now) {
        Objects.requireNonNull(spaceId, "spaceId");
        Objects.requireNonNull(now, "now");
        int ended = 0;
        for (StandingRideArrangementEntity entity :
                repository.findBySpaceIdAndStatusInOrderByCreatedAtAsc(
                        spaceId, List.of(StandingRideArrangementStatus.OPEN))) {
            ZoneId zone = ZoneId.of(entity.timeZone());
            Instant dayStart =
                    entity.anchorStartsAt().atZone(zone).toLocalDate().atStartOfDay(zone).toInstant();
            if (!now.isBefore(dayStart)) {
                entity.end(now);
                repository.save(entity);
                ended++;
            }
        }
        return ended;
    }

    /** OPEN → ACTIVE with fixed primary. */
    @Transactional
    public StandingRideArrangementDto activate(
            UUID spaceId, UUID arrangementId, UUID primaryAdultId, UUID primaryCircleId) {
        Objects.requireNonNull(primaryAdultId, "primaryAdultId");
        Objects.requireNonNull(primaryCircleId, "primaryCircleId");
        StandingRideArrangementEntity entity = requireInSpace(spaceId, arrangementId);
        try {
            entity.activate(primaryAdultId, primaryCircleId);
        } catch (IllegalStateException ex) {
            throw new CarpoolException(HttpStatus.CONFLICT, "Arrangement is not open for accept");
        }
        return toDto(repository.save(entity));
    }

    /** Marks ENDED and clears primary. Idempotent when already ENDED. */
    @Transactional
    public StandingRideArrangementDto end(UUID spaceId, UUID arrangementId) {
        StandingRideArrangementEntity entity = requireInSpace(spaceId, arrangementId);
        entity.end(Instant.now());
        return toDto(repository.save(entity));
    }

    private StandingRideArrangementEntity requireInSpace(UUID spaceId, UUID arrangementId) {
        Objects.requireNonNull(spaceId, "spaceId");
        Objects.requireNonNull(arrangementId, "arrangementId");
        return repository
                .findByIdAndSpaceId(arrangementId, spaceId)
                .orElseThrow(
                        () -> new CarpoolException(HttpStatus.NOT_FOUND, "Arrangement not found"));
    }

    private static StandingRideAskTemplateDto normalizeAskTemplate(StandingRideAskTemplateDto ask) {
        if (ask == null || ask.kids() == null || ask.kids().isEmpty()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "ask template requires kids");
        }
        if (ask.legs() == null || ask.legs().size() != 2) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "ask template requires TO and FROM legs");
        }
        List<StandingRideAskKidDto> kids = new ArrayList<>(ask.kids().size());
        for (StandingRideAskKidDto kid : ask.kids()) {
            if (kid == null || kid.kidId() == null) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "each kid requires kidId");
            }
            String name = kid.firstName() == null ? "" : kid.firstName().trim();
            if (name.isEmpty()) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "each kid requires firstName");
            }
            kids.add(new StandingRideAskKidDto(kid.kidId(), name));
        }
        StandingRideAskLegDto to = null;
        StandingRideAskLegDto from = null;
        for (StandingRideAskLegDto leg : ask.legs()) {
            if (leg == null || leg.kind() == null) {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "each leg requires kind");
            }
            if (leg.kind() == CarpoolLegKind.TO) {
                to = normalizeLeg(leg);
            } else if (leg.kind() == CarpoolLegKind.FROM) {
                from = normalizeLeg(leg);
            } else {
                throw new CarpoolException(HttpStatus.BAD_REQUEST, "unknown leg kind");
            }
        }
        if (to == null || from == null) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "ask template requires TO and FROM legs");
        }
        if (to.phase() != CarpoolLegPhase.ASKED_TEAM && from.phase() != CarpoolLegPhase.ASKED_TEAM) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "ask template requires at least one ASKED_TEAM leg");
        }
        return new StandingRideAskTemplateDto(List.copyOf(kids), List.of(to, from));
    }

    private static StandingRideAskLegDto normalizeLeg(StandingRideAskLegDto leg) {
        CarpoolLegPhase phase = leg.phase();
        if (phase != CarpoolLegPhase.ASKED_TEAM && phase != CarpoolLegPhase.NEEDS_RIDE) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "ask template legs must be ASKED_TEAM or NEEDS_RIDE");
        }
        if (leg.placeId() != null
                && leg.oneTimeAddress() != null
                && !leg.oneTimeAddress().isBlank()) {
            throw new CarpoolException(
                    HttpStatus.BAD_REQUEST, "placeId and oneTimeAddress are mutually exclusive");
        }
        CarpoolMeetSide meetSide =
                leg.meetSide() == null ? CarpoolMeetSide.REQUESTER : leg.meetSide();
        if (phase == CarpoolLegPhase.NEEDS_RIDE) {
            meetSide = CarpoolMeetSide.REQUESTER;
        }
        return new StandingRideAskLegDto(
                leg.kind(),
                phase,
                leg.placeId(),
                blankToNull(leg.oneTimeAddress()),
                blankToNull(leg.placeName()),
                blankToNull(leg.placeAddress()),
                meetSide);
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String requireTimeZone(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "timeZone is required");
        }
        try {
            return ZoneId.of(timeZone.trim()).getId();
        } catch (Exception ex) {
            throw new CarpoolException(HttpStatus.BAD_REQUEST, "timeZone is invalid");
        }
    }

    private static List<RideKidSnapshot> toKidEntities(List<StandingRideAskKidDto> kids) {
        List<RideKidSnapshot> entities = new ArrayList<>(kids.size());
        for (StandingRideAskKidDto kid : kids) {
            entities.add(new RideKidSnapshot(kid.kidId(), kid.firstName()));
        }
        return entities;
    }

    private static List<StandingRideAskLegSlot> toLegEntities(List<StandingRideAskLegDto> legs) {
        List<StandingRideAskLegSlot> entities = new ArrayList<>(2);
        for (StandingRideAskLegDto leg : legs) {
            entities.add(
                    new StandingRideAskLegSlot(
                            leg.kind(),
                            leg.phase(),
                            leg.meetSide(),
                            leg.placeId(),
                            leg.oneTimeAddress(),
                            leg.placeName(),
                            leg.placeAddress()));
        }
        return entities;
    }

    private static StandingRideArrangementDto toDto(StandingRideArrangementEntity entity) {
        RecurringFeedFingerprint fingerprint =
                new RecurringFeedFingerprint(
                        entity.feedId(),
                        DayOfWeek.valueOf(entity.dayOfWeek()),
                        entity.minuteOfDay(),
                        entity.normalizedLocation());
        List<StandingRideAskKidDto> kids =
                entity.kids().stream()
                        .map(k -> new StandingRideAskKidDto(k.kidId(), k.firstName()))
                        .toList();
        List<StandingRideAskLegDto> legs =
                entity.legs().stream()
                        .map(
                                leg ->
                                        new StandingRideAskLegDto(
                                                leg.kind(),
                                                leg.phase(),
                                                leg.placeId(),
                                                leg.oneTimeAddress(),
                                                leg.placeName(),
                                                leg.placeAddress(),
                                                leg.meetSide()))
                        .toList();
        return new StandingRideArrangementDto(
                entity.id(),
                entity.spaceId(),
                entity.requestingCircleId(),
                entity.requestedByAdultId(),
                fingerprint,
                entity.timeZone(),
                entity.anchorStartsAt(),
                entity.assignment(),
                entity.status(),
                entity.primaryAdultId(),
                entity.primaryCircleId(),
                new StandingRideAskTemplateDto(kids, legs),
                entity.createdAt(),
                entity.endedAt());
    }
}
