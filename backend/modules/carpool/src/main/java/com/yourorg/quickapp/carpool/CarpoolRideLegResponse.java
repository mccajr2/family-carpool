package com.yourorg.quickapp.carpool;

import java.util.UUID;

public record CarpoolRideLegResponse(
        CarpoolLegKind kind,
        CarpoolLegPhase phase,
        UUID assigneeAdultId,
        String assigneeDisplayName,
        UUID assigneeCircleId,
        String assigneeCircleName) {}
