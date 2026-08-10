package com.yourorg.quickapp.family;

import jakarta.validation.constraints.NotNull;

public record UpdateFamilyMemberRoleRequest(@NotNull FamilyRole role) {}
