package com.yourorg.quickapp.family;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateFamilyCircleRequest(
        @NotBlank @Size(max = 80) String adultDisplayName,
        @Size(max = 80) String name) {}
