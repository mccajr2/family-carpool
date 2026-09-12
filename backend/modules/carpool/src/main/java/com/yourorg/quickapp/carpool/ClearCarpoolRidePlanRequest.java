package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

/** Clear specific plan legs (household CONFIRMED / WAITING / ASKED_TEAM) by event. */
public record ClearCarpoolRidePlanRequest(
        @NotBlank String eventKey, List<CarpoolLegKind> legs) {}
