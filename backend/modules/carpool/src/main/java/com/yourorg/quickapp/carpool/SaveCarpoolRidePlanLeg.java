package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SaveCarpoolRidePlanLeg(
        @NotNull CarpoolLegKind kind,
        @NotNull CarpoolRidePlanLegAction action,
        UUID assigneeAdultId) {}
