package com.yourorg.quickapp.family;

import java.util.UUID;

/**
 * Fired when an adult's default leave-from or a circle place used as a driving
 * origin may have changed. Leaveby invalidates cached multi-stop itineraries
 * for the adult (fingerprint refresh on next GET also covers this).
 */
public record DrivingOriginChangedEvent(UUID adultId) {}
