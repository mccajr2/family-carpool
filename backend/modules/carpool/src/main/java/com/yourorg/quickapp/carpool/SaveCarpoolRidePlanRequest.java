package com.yourorg.quickapp.carpool;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record SaveCarpoolRidePlanRequest(
        @NotBlank String eventKey,
        @NotEmpty List<@NotNull @Valid SaveCarpoolRidePlanGroup> plans) {}
