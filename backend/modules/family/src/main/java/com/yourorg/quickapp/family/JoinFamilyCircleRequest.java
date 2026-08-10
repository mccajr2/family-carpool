package com.yourorg.quickapp.family;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinFamilyCircleRequest(
        @NotBlank @Size(max = 16) String code,
        @Size(max = 80) String adultDisplayName) {}
