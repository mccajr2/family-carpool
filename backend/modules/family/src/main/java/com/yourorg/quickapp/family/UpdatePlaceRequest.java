package com.yourorg.quickapp.family;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdatePlaceRequest(
        @NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 255) String address) {}
