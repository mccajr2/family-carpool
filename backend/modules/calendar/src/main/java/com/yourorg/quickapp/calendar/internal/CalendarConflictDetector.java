package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarConflictResponse;
import com.yourorg.quickapp.calendar.CalendarConflictType;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.coverage.ScheduleIntervals;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Detects kid time-overlaps and adult coverage overlaps for Agenda enrichment.
 * Does not enforce the CONFIRMED double-book 409 (coverage writes own that).
 */
final class CalendarConflictDetector {

    record ActiveCoverage(UUID adultId, CoverageStatus status) {}

    record ScheduleItem(
            UUID id,
            CalendarItemSource source,
            String title,
            Instant startsAt,
            Instant endsAt,
            List<UUID> kidIds,
            List<ActiveCoverage> activeCoverages) {}

    private CalendarConflictDetector() {}

    static Map<ItemKey, List<CalendarConflictResponse>> detect(
            List<ScheduleItem> items, Map<UUID, String> adultDisplayNames) {
        Map<ItemKey, List<CalendarConflictResponse>> byItem = new HashMap<>();
        for (int i = 0; i < items.size(); i++) {
            for (int j = i + 1; j < items.size(); j++) {
                ScheduleItem a = items.get(i);
                ScheduleItem b = items.get(j);
                if (!ScheduleIntervals.overlaps(
                        a.startsAt(), a.endsAt(), b.startsAt(), b.endsAt())) {
                    continue;
                }
                addKidConflicts(byItem, a, b);
                addAdultConflicts(byItem, a, b, adultDisplayNames);
            }
        }
        byItem.replaceAll((key, list) -> List.copyOf(list));
        return Map.copyOf(byItem);
    }

    private static void addKidConflicts(
            Map<ItemKey, List<CalendarConflictResponse>> byItem, ScheduleItem a, ScheduleItem b) {
        if (a.kidIds() == null || b.kidIds() == null) {
            return;
        }
        for (UUID kidId : a.kidIds()) {
            if (kidId != null && b.kidIds().contains(kidId)) {
                add(byItem, key(a), kidConflict(kidId, b));
                add(byItem, key(b), kidConflict(kidId, a));
            }
        }
    }

    private static void addAdultConflicts(
            Map<ItemKey, List<CalendarConflictResponse>> byItem,
            ScheduleItem a,
            ScheduleItem b,
            Map<UUID, String> adultDisplayNames) {
        for (ActiveCoverage ac : a.activeCoverages()) {
            for (ActiveCoverage bc : b.activeCoverages()) {
                if (!ac.adultId().equals(bc.adultId())) {
                    continue;
                }
                // Amber when at least one side is PENDING (PENDING+PENDING or PENDING+CONFIRMED).
                // CONFIRMED+CONFIRMED is blocked on write; still surface if data is anomalous.
                if (ac.status() == CoverageStatus.PENDING
                        || bc.status() == CoverageStatus.PENDING
                        || (ac.status() == CoverageStatus.CONFIRMED
                                && bc.status() == CoverageStatus.CONFIRMED)) {
                    String name = adultDisplayNames.get(ac.adultId());
                    add(byItem, key(a), adultConflict(ac.adultId(), name, b));
                    add(byItem, key(b), adultConflict(ac.adultId(), name, a));
                }
            }
        }
    }

    private static CalendarConflictResponse kidConflict(UUID kidId, ScheduleItem other) {
        return new CalendarConflictResponse(
                CalendarConflictType.KID_TIME_OVERLAP,
                kidId,
                null,
                null,
                other.source(),
                other.id(),
                other.title(),
                other.startsAt());
    }

    private static CalendarConflictResponse adultConflict(
            UUID adultId, String adultDisplayName, ScheduleItem other) {
        return new CalendarConflictResponse(
                CalendarConflictType.ADULT_COVERAGE_OVERLAP,
                null,
                adultId,
                adultDisplayName,
                other.source(),
                other.id(),
                other.title(),
                other.startsAt());
    }

    private static void add(
            Map<ItemKey, List<CalendarConflictResponse>> byItem,
            ItemKey key,
            CalendarConflictResponse conflict) {
        byItem.computeIfAbsent(key, ignored -> new ArrayList<>()).add(conflict);
    }

    private static ItemKey key(ScheduleItem item) {
        return new ItemKey(item.source(), item.id());
    }

    record ItemKey(CalendarItemSource source, UUID id) {
        ItemKey {
            Objects.requireNonNull(source);
            Objects.requireNonNull(id);
        }
    }
}
