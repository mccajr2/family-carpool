package com.yourorg.quickapp.carpool;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Create a gated standing series Ask. Legs use the Save-plan triad; only
 * {@link CarpoolRidePlanLegAction#ASK_TEAM} and {@link
 * CarpoolRidePlanLegAction#NEEDS_RIDE} are allowed (no household).
 */
public record CreateStandingRideArrangementRequest(
        @NotBlank String eventKey,
        @NotBlank String timeZone,
        List<@NotNull UUID> kidIds,
        @NotEmpty @Size(min = 2, max = 2) List<@NotNull @Valid SaveCarpoolRidePlanLeg> legs) {}
