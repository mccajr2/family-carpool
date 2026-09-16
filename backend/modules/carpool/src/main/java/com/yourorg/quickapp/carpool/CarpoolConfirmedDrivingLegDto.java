package com.yourorg.quickapp.carpool;

import java.util.UUID;

/** One CONFIRMED leg where the viewing adult is the assignee. */
public record CarpoolConfirmedDrivingLegDto(UUID feedEventId, CarpoolLegKind leg) {}
