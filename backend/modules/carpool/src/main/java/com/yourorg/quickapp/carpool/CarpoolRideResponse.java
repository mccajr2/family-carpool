package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

public record CarpoolRideResponse(
        UUID id,
        UUID spaceId,
        String eventKey,
        CarpoolNeededLeg leg,
        UUID driverAdultId,
        UUID drivingCircleId,
        String drivingCircleName,
        UUID vehicleId,
        String vehicleLabel,
        List<UUID> passengerRequestIds,
        CarpoolFulfillmentStatus status) {}
