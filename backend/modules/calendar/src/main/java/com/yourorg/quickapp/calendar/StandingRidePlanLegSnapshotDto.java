package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import java.util.UUID;

/** Per-leg ride plan state at lock time (household / circle-local). */
public record StandingRidePlanLegSnapshotDto(
        CarpoolLegKind kind,
        CarpoolLegPhase phase,
        UUID assigneeAdultId,
        UUID assigneeCircleId,
        UUID placeId,
        String placeName,
        String placeAddress,
        CarpoolMeetSide meetSide) {}
