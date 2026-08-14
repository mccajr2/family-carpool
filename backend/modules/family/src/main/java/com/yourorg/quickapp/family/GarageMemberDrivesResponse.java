package com.yourorg.quickapp.family;

import java.util.UUID;

public record GarageMemberDrivesResponse(UUID adultId, String displayName, boolean drives) {}
