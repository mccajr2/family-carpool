package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarCoverageAssignmentResponse;
import com.yourorg.quickapp.calendar.CalendarDriveBlockLinkResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByVenueDriveDto;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Attaches driving-block adjacency links to calendar rows for the viewing adult.
 * Uses carpool confirmed legs + leave-by cache reads only (no HTTP).
 */
@Component
class DriveBlockEnricher {

    /**
     * Interim Combine/Split links only for siblings close enough to be one
     * outing. Chronologically "next" confirmed drive tomorrow at another rink
     * must not get a link.
     */
    static final Duration MAX_INTERIM_LINK_START_GAP = Duration.ofHours(6);

    private final CarpoolApi carpoolApi;
    private final LeaveByApi leaveByApi;
    private final DriveBlockOverrideService overrideService;

    DriveBlockEnricher(
            CarpoolApi carpoolApi,
            LeaveByApi leaveByApi,
            DriveBlockOverrideService overrideService) {
        this.carpoolApi = carpoolApi;
        this.leaveByApi = leaveByApi;
        this.overrideService = overrideService;
    }

    List<CalendarItemResponse> attach(
            UUID adultId, UUID circleId, List<CalendarItemResponse> items) {
        if (items == null || items.isEmpty()) {
            return items == null ? List.of() : items;
        }

        List<UUID> feedIds =
                items.stream()
                        .filter(item -> item.source() == CalendarItemSource.FEED)
                        .map(CalendarItemResponse::id)
                        .toList();
        if (feedIds.isEmpty()) {
            return items.stream().map(item -> withLinks(item, List.of())).toList();
        }

        List<CarpoolConfirmedDrivingLegDto> confirmed =
                carpoolApi.listConfirmedDrivingLegs(adultId, circleId, feedIds);

        Map<UUID, Set<CarpoolLegKind>> legsByFeed = new HashMap<>();
        for (CarpoolConfirmedDrivingLegDto row : confirmed) {
            legsByFeed
                    .computeIfAbsent(row.feedEventId(), ignored -> new HashSet<>())
                    .add(row.leg());
        }
        // Feeds without a carpool space still show You're driving via coverage
        // CONFIRMED (e.g. Mite 3). Count those as TO for block membership so
        // same-rink back-to-backs merge with space-backed plans (Squirt).
        for (CalendarItemResponse item : items) {
            if (item.source() != CalendarItemSource.FEED) {
                continue;
            }
            if (!isCoverageConfirmedDriver(item, adultId)) {
                continue;
            }
            legsByFeed.computeIfAbsent(item.id(), ignored -> new HashSet<>()).add(CarpoolLegKind.TO);
        }
        if (legsByFeed.isEmpty()) {
            return items.stream().map(item -> withLinks(item, List.of())).toList();
        }

        Map<UUID, CalendarItemResponse> feedItems = new HashMap<>();
        for (CalendarItemResponse item : items) {
            if (item.source() == CalendarItemSource.FEED && legsByFeed.containsKey(item.id())) {
                feedItems.put(item.id(), item);
            }
        }
        if (feedItems.isEmpty()) {
            return items.stream().map(item -> withLinks(item, List.of())).toList();
        }

        List<CalendarItemResponse> eligibleOrdered = new ArrayList<>(feedItems.values());
        List<LeaveByItemInput> leaveInputs = new ArrayList<>(eligibleOrdered.size());
        for (CalendarItemResponse item : eligibleOrdered) {
            leaveInputs.add(
                    new LeaveByItemInput(
                            LeaveByItemSource.FEED,
                            item.id(),
                            item.startsAt(),
                            item.location()));
        }
        List<LeaveByVenueDriveDto> venues = leaveByApi.cheapVenueDrives(adultId, leaveInputs);
        Map<UUID, LeaveByVenueDriveDto> venueById = new HashMap<>();
        for (int i = 0; i < eligibleOrdered.size(); i++) {
            venueById.put(eligibleOrdered.get(i).id(), venues.get(i));
        }

        List<DrivingBlockComputer.EligibleItem> eligible = new ArrayList<>();
        for (CalendarItemResponse item : eligibleOrdered) {
            LeaveByVenueDriveDto venue =
                    venueById.getOrDefault(item.id(), LeaveByVenueDriveDto.unavailable());
            int padding = leaveByApi.arrivalBufferMinutes(item.title());
            for (CarpoolLegKind leg : legsByFeed.getOrDefault(item.id(), Set.of())) {
                eligible.add(
                        new DrivingBlockComputer.EligibleItem(
                                item.id(),
                                CalendarItemSource.FEED,
                                leg,
                                item.startsAt(),
                                item.endsAt(),
                                venue.venueIdentity(),
                                venue.oneWayDriveSeconds(),
                                padding));
            }
        }

        List<DrivingBlockComputer.PairOverride> overrides =
                overrideService.pairOverridesForAdult(adultId);
        List<DrivingBlockComputer.DriveBlock> blocks =
                DrivingBlockComputer.compute(eligible, overrides);

        Map<String, DriveBlockOverrideAction> overrideByPair = new HashMap<>();
        for (DrivingBlockComputer.PairOverride override : overrides) {
            overrideByPair.put(pairKey(override), override.action());
        }

        Map<ItemLegKey, List<CalendarDriveBlockLinkResponse>> linksByItem = new HashMap<>();
        // Interim Agenda control is TO-only. Household confirms usually set TO+FROM;
        // emitting both produced duplicate identical copy on the later card.
        // FROM blocks still compute above for overrides / later block UI.
        for (CarpoolLegKind leg : List.of(CarpoolLegKind.TO)) {
            List<CalendarItemResponse> legItems =
                    eligibleOrdered.stream()
                            .filter(item -> legsByFeed.getOrDefault(item.id(), Set.of()).contains(leg))
                            .sorted(
                                    (a, b) -> {
                                        int byStart = a.startsAt().compareTo(b.startsAt());
                                        if (byStart != 0) {
                                            return byStart;
                                        }
                                        return a.id().compareTo(b.id());
                                    })
                            .toList();
            if (legItems.size() < 2) {
                continue;
            }
            Set<String> combinedPairs = combinedAdjacentPairs(blocks, leg);
            for (int i = 0; i < legItems.size() - 1; i++) {
                CalendarItemResponse left = legItems.get(i);
                CalendarItemResponse right = legItems.get(i + 1);
                String pair = pairKey(leg, left.source(), left.id(), right.source(), right.id());
                boolean combined = combinedPairs.contains(pair);
                DriveBlockOverrideAction action = overrideByPair.get(pair);
                if (!shouldEmitInterimLink(left, right, combined, action)) {
                    continue;
                }
                CalendarDriveBlockLinkResponse leftLink =
                        new CalendarDriveBlockLinkResponse(
                                leg,
                                right.source(),
                                right.id(),
                                right.title(),
                                right.startsAt(),
                                combined,
                                action);
                CalendarDriveBlockLinkResponse rightLink =
                        new CalendarDriveBlockLinkResponse(
                                leg,
                                left.source(),
                                left.id(),
                                left.title(),
                                left.startsAt(),
                                combined,
                                action);
                linksByItem
                        .computeIfAbsent(new ItemLegKey(left.id(), left.source()), ignored -> new ArrayList<>())
                        .add(leftLink);
                linksByItem
                        .computeIfAbsent(
                                new ItemLegKey(right.id(), right.source()), ignored -> new ArrayList<>())
                        .add(rightLink);
            }
        }

        List<CalendarItemResponse> out = new ArrayList<>(items.size());
        for (CalendarItemResponse item : items) {
            List<CalendarDriveBlockLinkResponse> links =
                    linksByItem.getOrDefault(new ItemLegKey(item.id(), item.source()), List.of());
            out.add(withLinks(item, List.copyOf(links)));
        }
        return List.copyOf(out);
    }

    /**
     * Interim Agenda links are for one outing — not "next confirmed drive on
     * the calendar" across days/rinks. Combined / override pairs always keep a
     * link so clear/split stays reachable.
     */
    static boolean shouldEmitInterimLink(
            CalendarItemResponse left,
            CalendarItemResponse right,
            boolean combined,
            DriveBlockOverrideAction action) {
        if (combined || action != null) {
            return true;
        }
        Duration startGap = Duration.between(left.startsAt(), right.startsAt()).abs();
        return startGap.compareTo(MAX_INTERIM_LINK_START_GAP) < 0;
    }

    private static boolean isCoverageConfirmedDriver(CalendarItemResponse item, UUID adultId) {
        if (item.coverages() == null || item.coverages().isEmpty()) {
            return false;
        }
        for (CalendarCoverageAssignmentResponse coverage : item.coverages()) {
            if (coverage.status() == CoverageStatus.CONFIRMED
                    && adultId.equals(coverage.coveringAdultId())) {
                return true;
            }
        }
        return false;
    }

    private static Set<String> combinedAdjacentPairs(
            List<DrivingBlockComputer.DriveBlock> blocks, CarpoolLegKind leg) {
        Set<String> combined = new HashSet<>();
        for (DrivingBlockComputer.DriveBlock block : blocks) {
            if (block.leg() != leg || block.items().size() < 2) {
                continue;
            }
            List<DrivingBlockComputer.ItemRef> members = block.items();
            for (int i = 0; i < members.size() - 1; i++) {
                DrivingBlockComputer.ItemRef left = members.get(i);
                DrivingBlockComputer.ItemRef right = members.get(i + 1);
                combined.add(
                        pairKey(leg, left.source(), left.id(), right.source(), right.id()));
            }
        }
        return combined;
    }

    private static String pairKey(DrivingBlockComputer.PairOverride override) {
        return pairKey(
                override.leg(),
                override.leftSource(),
                override.leftId(),
                override.rightSource(),
                override.rightId());
    }

    private static String pairKey(
            CarpoolLegKind leg,
            CalendarItemSource leftSource,
            UUID leftId,
            CalendarItemSource rightSource,
            UUID rightId) {
        return leg.name()
                + "|"
                + leftSource.name()
                + "|"
                + leftId
                + "|"
                + rightSource.name()
                + "|"
                + rightId;
    }

    private static CalendarItemResponse withLinks(
            CalendarItemResponse item, List<CalendarDriveBlockLinkResponse> links) {
        return new CalendarItemResponse(
                item.id(),
                item.source(),
                item.title(),
                item.startsAt(),
                item.endsAt(),
                item.location(),
                item.kidIds(),
                item.feedId(),
                item.feedName(),
                item.eventKey(),
                item.leaveFromPlaceId(),
                item.leaveFromPlaceName(),
                item.leaveFromAddress(),
                item.leaveByAt(),
                item.leaveByStatus(),
                item.leaveByReason(),
                item.coverages(),
                item.uncoveredKidIds(),
                item.conflicts(),
                item.rsvps(),
                links);
    }

    private record ItemLegKey(UUID id, CalendarItemSource source) {}
}
