package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

/** Accepted teammate pickup visible for multi-stop route building. */
public record CarpoolAcceptedPickupDto(
        UUID acceptedByAdultId,
        UUID acceptingCircleId,
        UUID requestingCircleId,
        String pickupPlaceName,
        String pickupAddress,
        List<UUID> kidIds) {}
