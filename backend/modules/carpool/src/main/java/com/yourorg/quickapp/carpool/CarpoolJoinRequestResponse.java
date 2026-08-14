package com.yourorg.quickapp.carpool;

import java.util.UUID;

public record CarpoolJoinRequestResponse(
        UUID id,
        UUID spaceId,
        UUID circleId,
        String circleName,
        UUID requestedByAdultId,
        String requestedByDisplayName) {}
