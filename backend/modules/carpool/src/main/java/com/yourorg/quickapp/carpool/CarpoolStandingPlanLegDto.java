package com.yourorg.quickapp.carpool;

import java.util.UUID;

/**
 * Per-leg standing snapshot with write triad: named {@code placeId}, one-time
 * {@code oneTimeAddress}, or both null (Default). Display name/address are not
 * included — re-apply must not send mutually exclusive place fields.
 */
public record CarpoolStandingPlanLegDto(
        CarpoolLegKind kind,
        CarpoolLegPhase phase,
        UUID assigneeAdultId,
        UUID assigneeCircleId,
        UUID placeId,
        String oneTimeAddress,
        CarpoolMeetSide meetSide) {}
