package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SaveCarpoolRidePlanLeg(
        @NotNull CarpoolLegKind kind,
        @NotNull CarpoolRidePlanLegAction action,
        UUID assigneeAdultId,
        /** Named located circle place; mutually exclusive with {@code placeAddress}. */
        UUID placeId,
        /**
         * One-time free-text family-side address; mutually exclusive with {@code placeId}.
         * Both null = Default (membership default leave-from, then first located).
         */
        String placeAddress) {

    public SaveCarpoolRidePlanLeg(
            CarpoolLegKind kind, CarpoolRidePlanLegAction action, UUID assigneeAdultId) {
        this(kind, action, assigneeAdultId, null, null);
    }
}
