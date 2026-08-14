package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinCarpoolSpaceRequest(
        @NotBlank @Size(max = 16) String code) {}
