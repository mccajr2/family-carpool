package com.yourorg.quickapp.family;

import java.util.UUID;

/**
 * Kid display name for other modules (e.g. carpool ride-request snapshots).
 */
public record FamilyKidName(UUID id, String displayName) {}
