package com.yourorg.quickapp.carpool;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CarpoolRideEventResponse(
        String eventKey,
        String title,
        Instant startsAt,
        Instant endsAt,
        List<UUID> defaultKidIds,
        List<CarpoolRequestResponse> ownRequests,
        List<CarpoolRequestResponse> otherRequests,
        List<CarpoolRideResponse> rides) {}
