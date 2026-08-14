package com.yourorg.quickapp.carpool;

import java.util.UUID;

public record CarpoolSpaceMemberResponse(
        UUID circleId, String circleName, CarpoolSpaceMembership membership) {}
