package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Groups confirmed-driving calendar items into driving blocks for one viewing
 * adult. Pure compute: callers supply live leg assignments, venue identity,
 * drive-time seconds, title padding, and any persisted overrides.
 */
final class DrivingBlockComputer {

    /** Contiguity slack on top of round-trip home↔venue (locked for v1). */
    static final Duration CONTIGUITY_BUFFER = Duration.ofMinutes(15);

    /** Raw-gap merge threshold when drive-time or endsAt is unavailable. */
    static final Duration FALLBACK_RAW_GAP = Duration.ofMinutes(30);

    /**
     * One confirmed-driving event for the viewing adult on a single leg.
     *
     * @param venueIdentity leave-by destination geocode identity (rounded
     *     coords key); null when geocode is missing
     * @param oneWayDriveSeconds home→venue duration when cached / OK; null when
     *     PENDING, UNAVAILABLE, or no home
     * @param paddingMinutes arrival buffer for this event (from leave-by title
     *     heuristic)
     */
    record EligibleItem(
            UUID id,
            CalendarItemSource source,
            CarpoolLegKind leg,
            Instant startsAt,
            Instant endsAt,
            String venueIdentity,
            Integer oneWayDriveSeconds,
            int paddingMinutes) {}

    /** Ordered adjacent-pair override for one adult + leg. */
    record PairOverride(
            CarpoolLegKind leg,
            CalendarItemSource leftSource,
            UUID leftId,
            CalendarItemSource rightSource,
            UUID rightId,
            DriveBlockOverrideAction action) {}

    record ItemRef(CalendarItemSource source, UUID id) {}

    record DriveBlock(CarpoolLegKind leg, List<ItemRef> items) {}

    private DrivingBlockComputer() {}

    /**
     * Venue identity matching leave-by / OSRM rounding (6 decimal places).
     * Null coords → null identity (never auto-merges on venue).
     */
    static String venueIdentity(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            return null;
        }
        return String.format(Locale.ROOT, "%.6f,%.6f", latitude, longitude);
    }

    /**
     * Compute blocks for the viewing adult. {@code items} must already be
     * filtered to that adult's confirmed legs (TO and FROM may both appear).
     * Overrides that do not match an ordered adjacent pair are ignored.
     */
    static List<DriveBlock> compute(List<EligibleItem> items, List<PairOverride> overrides) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        Map<CarpoolLegKind, List<EligibleItem>> byLeg = new HashMap<>();
        for (EligibleItem item : items) {
            byLeg.computeIfAbsent(item.leg(), ignored -> new ArrayList<>()).add(item);
        }
        List<DriveBlock> blocks = new ArrayList<>();
        for (CarpoolLegKind leg : CarpoolLegKind.values()) {
            List<EligibleItem> legItems = byLeg.get(leg);
            if (legItems == null || legItems.isEmpty()) {
                continue;
            }
            blocks.addAll(computeForLeg(leg, legItems, overrides));
        }
        return List.copyOf(blocks);
    }

    private static List<DriveBlock> computeForLeg(
            CarpoolLegKind leg, List<EligibleItem> rawItems, List<PairOverride> overrides) {
        List<EligibleItem> items = new ArrayList<>(rawItems);
        items.sort(
                Comparator.comparing(EligibleItem::startsAt)
                        .thenComparing(item -> item.id().toString()));

        boolean[] mergeWithNext = new boolean[items.size()];
        for (int i = 0; i < items.size() - 1; i++) {
            mergeWithNext[i] = shouldAutoMerge(items.get(i), items.get(i + 1));
        }

        if (overrides != null) {
            for (PairOverride override : overrides) {
                if (override == null || override.leg() != leg) {
                    continue;
                }
                int index = findAdjacentPairIndex(items, override);
                if (index < 0) {
                    continue;
                }
                mergeWithNext[index] =
                        override.action() == DriveBlockOverrideAction.FORCE_MERGE;
            }
        }

        List<DriveBlock> blocks = new ArrayList<>();
        int start = 0;
        while (start < items.size()) {
            int end = start;
            while (end < items.size() - 1 && mergeWithNext[end]) {
                end++;
            }
            List<ItemRef> members = new ArrayList<>(end - start + 1);
            for (int i = start; i <= end; i++) {
                EligibleItem item = items.get(i);
                members.add(new ItemRef(item.source(), item.id()));
            }
            blocks.add(new DriveBlock(leg, List.copyOf(members)));
            start = end + 1;
        }
        return blocks;
    }

    private static int findAdjacentPairIndex(List<EligibleItem> items, PairOverride override) {
        for (int i = 0; i < items.size() - 1; i++) {
            EligibleItem left = items.get(i);
            EligibleItem right = items.get(i + 1);
            if (left.source() == override.leftSource()
                    && left.id().equals(override.leftId())
                    && right.source() == override.rightSource()
                    && right.id().equals(override.rightId())) {
                return i;
            }
        }
        return -1;
    }

    static boolean shouldAutoMerge(EligibleItem earlier, EligibleItem later) {
        if (!sameVenue(earlier.venueIdentity(), later.venueIdentity())) {
            return false;
        }
        Instant earlierEnd = earlier.endsAt();
        boolean missingEndsAt = earlierEnd == null || later.endsAt() == null;
        if (earlierEnd == null) {
            earlierEnd = earlier.startsAt();
        }
        Duration rawGap = Duration.between(earlierEnd, later.startsAt());
        if (missingEndsAt || earlier.oneWayDriveSeconds() == null) {
            return rawGap.compareTo(FALLBACK_RAW_GAP) < 0;
        }
        Duration padding = Duration.ofMinutes(Math.max(0, later.paddingMinutes()));
        Duration effectiveGap = rawGap.minus(padding);
        Duration roundTripPlusBuffer =
                Duration.ofSeconds(2L * earlier.oneWayDriveSeconds()).plus(CONTIGUITY_BUFFER);
        return effectiveGap.compareTo(roundTripPlusBuffer) < 0;
    }

    private static boolean sameVenue(String a, String b) {
        return a != null && Objects.equals(a, b);
    }
}
