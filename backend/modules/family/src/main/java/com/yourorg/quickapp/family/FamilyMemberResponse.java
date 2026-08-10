package com.yourorg.quickapp.family;

import java.util.UUID;

public record FamilyMemberResponse(
        UUID adultId, String email, String displayName, FamilyRole role) {}
