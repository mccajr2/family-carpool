package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarCoverageAssignmentResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByItemInput;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import com.yourorg.quickapp.leaveby.LeaveByVenueDriveDto;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Resolves the combined driving-block component that contains a calendar item
 * for one adult + leg (same adjacency rules as Agenda {@code driveBlockLinks}).
 */
@Component
class DriveBlockRouteResolver {

    /** Window around the path item so same-day contiguous blocks are visible. */
    static final Duration LOOKUP_WINDOW = Duration.ofHours(18);

    private final CarpoolApi carpoolApi;
    private final LeaveByApi leaveByApi;
    private final DriveBlockOverrideService overrideService;

    DriveBlockRouteResolver(
            CarpoolApi carpoolApi, LeaveByApi leaveByApi, DriveBlockOverrideService overrideService) {
        this.carpoolApi = carpoolApi;
        this.leaveByApi = leaveByApi;
        this.overrideService = overrideService;
    }

    /**
     * @param feedItems feed calendar rows in a window that includes {@code itemId}
     *     (coverages already attached when used for coverage-confirmed TO)
     */
    Optional<DrivingBlockComputer.DriveBlock> resolve(
            UUID adultId,
            UUID circleId,
            CalendarItemSource source,
            UUID itemId,
            CarpoolLegKind leg,
            List<CalendarItemResponse> feedItems) {
        if (source != CalendarItemSource.FEED || feedItems == null || feedItems.isEmpty()) {
            // Manual / empty: singleton block when the adult is driving that item.
            return Optional.of(
                    new DrivingBlockComputer.DriveBlock(
                            leg, List.of(new DrivingBlockComputer.ItemRef(source, itemId))));
        }

        List<UUID> feedIds = feedItems.stream().map(CalendarItemResponse::id).toList();
        List<CarpoolConfirmedDrivingLegDto> confirmed =
                carpoolApi.listConfirmedDrivingLegs(adultId, circleId, feedIds);

        Map<UUID, Set<CarpoolLegKind>> legsByFeed = new HashMap<>();
        for (CarpoolConfirmedDrivingLegDto row : confirmed) {
            legsByFeed
                    .computeIfAbsent(row.feedEventId(), ignored -> new HashSet<>())
                    .add(row.leg());
        }
        for (CalendarItemResponse item : feedItems) {
            if (isCoverageConfirmedDriver(item, adultId)) {
                legsByFeed.computeIfAbsent(item.id(), ignored -> new HashSet<>()).add(CarpoolLegKind.TO);
            }
        }
        if (!legsByFeed.getOrDefault(itemId, Set.of()).contains(leg)) {
            return Optional.empty();
        }

        Map<UUID, CalendarItemResponse> feedById = new HashMap<>();
        for (CalendarItemResponse item : feedItems) {
            if (legsByFeed.containsKey(item.id())) {
                feedById.put(item.id(), item);
            }
        }
        if (!feedById.containsKey(itemId)) {
            return Optional.empty();
        }

        List<CalendarItemResponse> eligibleOrdered = new ArrayList<>(feedById.values());
        List<LeaveByItemInput> leaveInputs = new ArrayList<>(eligibleOrdered.size());
        for (CalendarItemResponse item : eligibleOrdered) {
            leaveInputs.add(
                    new LeaveByItemInput(
                            LeaveByItemSource.FEED, item.id(), item.startsAt(), item.location()));
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
            for (CarpoolLegKind itemLeg : legsByFeed.getOrDefault(item.id(), Set.of())) {
                eligible.add(
                        new DrivingBlockComputer.EligibleItem(
                                item.id(),
                                CalendarItemSource.FEED,
                                itemLeg,
                                item.startsAt(),
                                item.endsAt(),
                                venue.venueIdentity(),
                                venue.oneWayDriveSeconds(),
                                padding));
            }
        }

        List<DrivingBlockComputer.DriveBlock> blocks =
                DrivingBlockComputer.compute(eligible, overrideService.pairOverridesForAdult(adultId));
        for (DrivingBlockComputer.DriveBlock block : blocks) {
            if (block.leg() != leg) {
                continue;
            }
            for (DrivingBlockComputer.ItemRef member : block.items()) {
                if (member.source() == source && member.id().equals(itemId)) {
                    return Optional.of(block);
                }
            }
        }
        return Optional.empty();
    }

    static Instant windowFrom(Instant startsAt) {
        return startsAt.minus(LOOKUP_WINDOW);
    }

    static Instant windowTo(Instant startsAt) {
        return startsAt.plus(LOOKUP_WINDOW);
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
}
