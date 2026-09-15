package com.yourorg.quickapp.carpool;

import java.util.UUID;

public record CarpoolRideLegResponse(
        CarpoolLegKind kind,
        CarpoolLegPhase phase,
        UUID assigneeAdultId,
        String assigneeDisplayName,
        UUID assigneeCircleId,
        String assigneeCircleName,
        /** Named place id when mode is named place; null for Default / one-time. */
        UUID placeId,
        /** Display name of the family-side place (snapshot or Default resolve). */
        String placeName,
        /** Display / one-time address of the family-side place. */
        String placeAddress,
        /**
         * Whose place is the meet point. Meaningful on Ask / confirmed team legs;
         * {@link CarpoolMeetSide#REQUESTER} for household / NEEDS_RIDE.
         */
        CarpoolMeetSide meetSide) {}
