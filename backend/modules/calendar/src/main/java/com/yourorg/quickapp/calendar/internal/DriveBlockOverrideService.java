package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.calendar.DriveBlockOverrideDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists FORCE_MERGE / FORCE_SPLIT pair overrides for the viewing adult.
 * Blocks remain computed; this table is the only block-related stored state.
 */
@Service
public class DriveBlockOverrideService {

    private final DriveBlockOverrideRepository repository;

    public DriveBlockOverrideService(DriveBlockOverrideRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public DriveBlockOverrideDto upsert(
            UUID adultId,
            CarpoolLegKind leg,
            CalendarItemSource leftItemSource,
            UUID leftItemId,
            CalendarItemSource rightItemSource,
            UUID rightItemId,
            DriveBlockOverrideAction action) {
        requirePair(adultId, leg, leftItemSource, leftItemId, rightItemSource, rightItemId, action);
        Instant now = Instant.now();
        DriveBlockOverrideEntity existing =
                repository
                        .findByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                                adultId,
                                leg,
                                leftItemSource,
                                leftItemId,
                                rightItemSource,
                                rightItemId)
                        .orElse(null);
        if (existing != null) {
            existing.setAction(action, now);
            return toDto(repository.save(existing));
        }
        DriveBlockOverrideEntity created =
                new DriveBlockOverrideEntity(
                        UUID.randomUUID(),
                        adultId,
                        leg,
                        leftItemSource,
                        leftItemId,
                        rightItemSource,
                        rightItemId,
                        action,
                        now);
        return toDto(repository.save(created));
    }

    /**
     * Clears the override for the pair. Returns {@code true} when a row was
     * removed (auto rule restored); {@code false} when nothing was stored.
     */
    @Transactional
    public boolean clear(
            UUID adultId,
            CarpoolLegKind leg,
            CalendarItemSource leftItemSource,
            UUID leftItemId,
            CalendarItemSource rightItemSource,
            UUID rightItemId) {
        requirePairIds(adultId, leg, leftItemSource, leftItemId, rightItemSource, rightItemId);
        return repository
                        .deleteByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                                adultId,
                                leg,
                                leftItemSource,
                                leftItemId,
                                rightItemSource,
                                rightItemId)
                > 0;
    }

    @Transactional(readOnly = true)
    public List<DriveBlockOverrideDto> listForAdult(UUID adultId) {
        Objects.requireNonNull(adultId, "adultId");
        return repository.findByAdultIdOrderByCreatedAtAsc(adultId).stream()
                .map(DriveBlockOverrideService::toDto)
                .toList();
    }

    /** Shape consumed by {@link DrivingBlockComputer}. */
    @Transactional(readOnly = true)
    public List<DrivingBlockComputer.PairOverride> pairOverridesForAdult(UUID adultId) {
        return listForAdult(adultId).stream()
                .map(
                        row ->
                                new DrivingBlockComputer.PairOverride(
                                        row.leg(),
                                        row.leftItemSource(),
                                        row.leftItemId(),
                                        row.rightItemSource(),
                                        row.rightItemId(),
                                        row.action()))
                .toList();
    }

    private static void requirePair(
            UUID adultId,
            CarpoolLegKind leg,
            CalendarItemSource leftItemSource,
            UUID leftItemId,
            CalendarItemSource rightItemSource,
            UUID rightItemId,
            DriveBlockOverrideAction action) {
        requirePairIds(adultId, leg, leftItemSource, leftItemId, rightItemSource, rightItemId);
        if (action == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "action is required");
        }
    }

    private static void requirePairIds(
            UUID adultId,
            CarpoolLegKind leg,
            CalendarItemSource leftItemSource,
            UUID leftItemId,
            CalendarItemSource rightItemSource,
            UUID rightItemId) {
        Objects.requireNonNull(adultId, "adultId");
        if (leg == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "leg is required");
        }
        if (leftItemSource == null || leftItemId == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "left item is required");
        }
        if (rightItemSource == null || rightItemId == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "right item is required");
        }
        if (leftItemSource == rightItemSource && leftItemId.equals(rightItemId)) {
            throw new CalendarException(
                    HttpStatus.BAD_REQUEST, "left and right items must be distinct");
        }
    }

    private static DriveBlockOverrideDto toDto(DriveBlockOverrideEntity entity) {
        return new DriveBlockOverrideDto(
                entity.id(),
                entity.adultId(),
                entity.leg(),
                entity.leftItemSource(),
                entity.leftItemId(),
                entity.rightItemSource(),
                entity.rightItemId(),
                entity.action(),
                entity.createdAt());
    }
}
