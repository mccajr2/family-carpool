package com.yourorg.quickapp.family;

import java.util.UUID;

/**
 * Set or clear the current adult's default leave-from place. {@code placeId}
 * null clears the default.
 */
public record SetDefaultLeaveFromRequest(UUID placeId) {}
