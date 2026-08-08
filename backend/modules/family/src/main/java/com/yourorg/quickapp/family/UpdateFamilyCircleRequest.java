package com.yourorg.quickapp.family;

import jakarta.validation.constraints.Size;

public record UpdateFamilyCircleRequest(@Size(max = 80) String name) {}
