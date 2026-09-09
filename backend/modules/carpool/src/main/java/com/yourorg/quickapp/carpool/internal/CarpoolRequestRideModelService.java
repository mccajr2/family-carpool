package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolFulfillmentStatus;
import com.yourorg.quickapp.carpool.CarpoolLeg;
import com.yourorg.quickapp.carpool.CarpoolLegCoverageStatus;
import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
import com.yourorg.quickapp.carpool.CarpoolRequestLegStatus;
import com.yourorg.quickapp.carpool.CarpoolRequestStatus;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * V2 domain helper for request/ride invariants and per-leg status derivation.
 */
@Service
class CarpoolRequestRideModelService {

    void requireUniqueRequest(
            UUID spaceId, String eventKey, UUID kidId, UUID requestingCircleId, CarpoolRequestRepository requests) {
        if (requests.existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
                spaceId, eventKey, kidId, requestingCircleId)) {
            throw new CarpoolException(
                    HttpStatus.CONFLICT, "A request for this kid/event/circle already exists");
        }
    }

    void requireNoPassengerLegConflict(
            UUID spaceId,
            String eventKey,
            UUID requestId,
            Set<CarpoolNeededLeg> legsNeeded,
            CarpoolRideRepository rides) {
        for (CarpoolNeededLeg leg : legsNeeded) {
            boolean conflict =
                    rides.existsActivePassengerAssignment(
                            spaceId, eventKey, leg, CarpoolFulfillmentStatus.ACTIVE, requestId);
            if (conflict) {
                throw new CarpoolException(
                        HttpStatus.CONFLICT, "Request leg is already assigned on another active ride");
            }
        }
    }

    Set<CarpoolNeededLeg> normalizedLegs(CarpoolLeg legs, Set<CarpoolNeededLeg> explicitLegsNeeded) {
        if (explicitLegsNeeded != null && !explicitLegsNeeded.isEmpty()) {
            return Set.copyOf(explicitLegsNeeded);
        }
        if (legs == null || legs == CarpoolLeg.BOTH) {
            return EnumSet.of(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
        }
        if (legs == CarpoolLeg.TO) {
            return Set.of(CarpoolNeededLeg.TO);
        }
        return Set.of(CarpoolNeededLeg.FROM);
    }

    DerivedRequestStatus deriveRequestStatus(
            Set<CarpoolNeededLeg> legsNeeded, Set<CarpoolNeededLeg> confirmedLegs) {
        Set<CarpoolNeededLeg> normalizedNeeded = new LinkedHashSet<>(legsNeeded);
        Set<CarpoolNeededLeg> normalizedConfirmed = new LinkedHashSet<>(confirmedLegs);
        List<CarpoolRequestLegStatus> legStatuses = new ArrayList<>();
        int confirmedCount = 0;
        for (CarpoolNeededLeg leg : normalizedNeeded) {
            boolean confirmed = normalizedConfirmed.contains(leg);
            if (confirmed) {
                confirmedCount++;
            }
            legStatuses.add(
                    new CarpoolRequestLegStatus(
                            leg, confirmed ? CarpoolLegCoverageStatus.CONFIRMED : CarpoolLegCoverageStatus.OPEN));
        }
        CarpoolRequestStatus rollup;
        if (confirmedCount == 0) {
            rollup = CarpoolRequestStatus.UNCOVERED;
        } else if (confirmedCount == normalizedNeeded.size()) {
            rollup = CarpoolRequestStatus.FULLY_COVERED;
        } else {
            rollup = CarpoolRequestStatus.PARTIAL;
        }
        return new DerivedRequestStatus(rollup, List.copyOf(legStatuses));
    }

    record DerivedRequestStatus(CarpoolRequestStatus rollup, List<CarpoolRequestLegStatus> legStatuses) {}
}
