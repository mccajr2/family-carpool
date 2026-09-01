package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

public record CarpoolRideResponse(
        UUID id,
        UUID spaceId,
        String eventKey,
        UUID requestingCircleId,
        String requestingCircleName,
        UUID requestedByAdultId,
        List<UUID> kidIds,
        List<String> kidFirstNames,
        int seats,
        String pickupPlaceName,
        String pickupAddress,
        CarpoolRideStatus status,
        boolean passedByMe,
        List<String> passedByAdultNames,
        UUID acceptedByAdultId,
        UUID acceptingCircleId,
        String acceptingCircleName,
        UUID vehicleId,
        String vehicleLabel,
        String pickupTown,
        Integer detourMinutes) {}
