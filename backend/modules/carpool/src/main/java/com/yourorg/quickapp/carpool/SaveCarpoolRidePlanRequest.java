package com.yourorg.quickapp.carpool;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record SaveCarpoolRidePlanRequest(
        @NotBlank String eventKey,
        List<@NotNull UUID> kidIds,
        @NotEmpty @Size(min = 2, max = 2) List<@NotNull @Valid SaveCarpoolRidePlanLeg> legs) {}
