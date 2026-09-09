package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record CreateCarpoolRideRequest(
        @NotBlank String eventKey,
        @NotNull CarpoolNeededLeg leg,
        @NotNull UUID vehicleId,
        @NotEmpty List<@NotNull UUID> passengerRequestIds) {}
