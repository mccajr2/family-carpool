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
        String placeAddress,
        /**
         * Meet side for ASK_TEAM legs. Null = {@link CarpoolMeetSide#REQUESTER}.
         * Ignored for HOUSEHOLD / NEEDS_RIDE. When {@link CarpoolMeetSide#ACCEPTOR},
         * place fields must be omitted (bound on Accept).
         */
        CarpoolMeetSide meetSide) {

    public SaveCarpoolRidePlanLeg(
            CarpoolLegKind kind, CarpoolRidePlanLegAction action, UUID assigneeAdultId) {
        this(kind, action, assigneeAdultId, null, null, null);
    }

    public SaveCarpoolRidePlanLeg(
            CarpoolLegKind kind,
            CarpoolRidePlanLegAction action,
            UUID assigneeAdultId,
            UUID placeId,
            String placeAddress) {
        this(kind, action, assigneeAdultId, placeId, placeAddress, null);
    }
}
