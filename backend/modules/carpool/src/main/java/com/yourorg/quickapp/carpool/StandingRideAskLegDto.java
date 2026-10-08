package com.yourorg.quickapp.carpool;

import java.util.UUID;

/**
 * Ask-template leg: {@link CarpoolLegPhase#ASKED_TEAM} or {@link
 * CarpoolLegPhase#NEEDS_RIDE} (one-way), family-side place triad, and meet side.
 */
public record StandingRideAskLegDto(
        CarpoolLegKind kind,
        CarpoolLegPhase phase,
        UUID placeId,
        String oneTimeAddress,
        String placeName,
        String placeAddress,
        CarpoolMeetSide meetSide) {}
