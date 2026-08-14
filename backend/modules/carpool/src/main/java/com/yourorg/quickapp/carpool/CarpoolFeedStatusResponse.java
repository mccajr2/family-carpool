package com.yourorg.quickapp.carpool;

import java.util.UUID;

public record CarpoolFeedStatusResponse(
        UUID feedId,
        String feedName,
        CarpoolFeedStatusKind status,
        UUID spaceId,
        String spaceName) {}
