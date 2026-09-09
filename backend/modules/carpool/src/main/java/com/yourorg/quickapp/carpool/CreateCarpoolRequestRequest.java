package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Set;
import java.util.UUID;

public record CreateCarpoolRequestRequest(
        @NotBlank String eventKey,
        @NotNull UUID kidId,
        CarpoolLeg legs,
        Set<CarpoolNeededLeg> legsNeeded) {}
