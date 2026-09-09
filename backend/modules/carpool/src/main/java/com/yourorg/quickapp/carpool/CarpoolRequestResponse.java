package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

public record CarpoolRequestResponse(
        UUID id,
        UUID spaceId,
        String eventKey,
        UUID requestingCircleId,
        String requestingCircleName,
        UUID requestedByAdultId,
        UUID kidId,
        String kidFirstName,
        List<CarpoolNeededLeg> legsNeeded,
        List<CarpoolRequestLegStatus> legStatuses,
        String pickupPlaceName,
        String pickupAddress,
        String pickupTown,
        Integer detourMinutes,
        CarpoolRequestStatus status,
        boolean passedByMe,
        List<String> passedByAdultNames) {}
