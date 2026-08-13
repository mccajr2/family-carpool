package com.yourorg.quickapp.rsvp.internal;

import com.yourorg.quickapp.rsvp.RsvpApi;
import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class RsvpApiImpl implements RsvpApi {

    private final RsvpRepository rsvps;

    RsvpApiImpl(RsvpRepository rsvps) {
        this.rsvps = rsvps;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RsvpDto> listForItems(
            UUID circleId, RsvpItemSource source, Collection<UUID> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) {
            return List.of();
        }
        return rsvps.findByCircleIdAndItemSourceAndItemIdIn(circleId, source, itemIds).stream()
                .map(RsvpApiImpl::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RsvpDto> statusesForKids(
            UUID circleId, RsvpItemSource source, UUID itemId, Collection<UUID> kidIds) {
        if (kidIds == null || kidIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, RsvpEntity> byKid =
                rsvps.findByCircleIdAndItemSourceAndItemId(circleId, source, itemId).stream()
                        .collect(Collectors.toMap(RsvpEntity::kidId, Function.identity()));
        return kidIds.stream()
                .distinct()
                .map(
                        kidId -> {
                            RsvpEntity row = byKid.get(kidId);
                            if (row == null) {
                                return new RsvpDto(source, itemId, kidId, RsvpStatus.NO_RESPONSE);
                            }
                            return toDto(row);
                        })
                .toList();
    }

    @Override
    @Transactional
    public RsvpDto setStatus(
            UUID circleId,
            RsvpItemSource source,
            UUID itemId,
            UUID kidId,
            RsvpStatus status,
            UUID updatedByAdultId) {
        if (status == null) {
            throw new IllegalArgumentException("status must not be null");
        }
        var existing =
                rsvps.findByCircleIdAndItemSourceAndItemIdAndKidId(circleId, source, itemId, kidId);
        if (status == RsvpStatus.NO_RESPONSE) {
            existing.ifPresent(rsvps::delete);
            return new RsvpDto(source, itemId, kidId, RsvpStatus.NO_RESPONSE);
        }
        Instant now = Instant.now();
        if (existing.isPresent()) {
            RsvpEntity row = existing.get();
            row.update(status, updatedByAdultId, now);
            return toDto(rsvps.save(row));
        }
        RsvpEntity created =
                new RsvpEntity(
                        UUID.randomUUID(),
                        circleId,
                        source,
                        itemId,
                        kidId,
                        status,
                        updatedByAdultId,
                        now,
                        now);
        return toDto(rsvps.save(created));
    }

    @Override
    @Transactional
    public void deleteForKidsNotOnItem(
            UUID circleId,
            RsvpItemSource source,
            UUID itemId,
            Collection<UUID> remainingKidIds) {
        Set<UUID> remaining =
                remainingKidIds == null ? Set.of() : new HashSet<>(remainingKidIds);
        List<RsvpEntity> rows =
                rsvps.findByCircleIdAndItemSourceAndItemId(circleId, source, itemId);
        for (RsvpEntity row : rows) {
            if (!remaining.contains(row.kidId())) {
                rsvps.delete(row);
            }
        }
    }

    private static RsvpDto toDto(RsvpEntity entity) {
        return new RsvpDto(
                entity.itemSource(), entity.itemId(), entity.kidId(), entity.status());
    }
}
