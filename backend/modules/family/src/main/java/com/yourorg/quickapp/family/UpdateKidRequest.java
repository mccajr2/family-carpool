package com.yourorg.quickapp.family;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateKidRequest(@NotBlank @Size(max = 80) String displayName) {}
