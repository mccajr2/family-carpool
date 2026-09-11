package com.yourorg.quickapp.carpool;

import java.util.List;

public record CancelCarpoolRideRequest(List<CarpoolLegKind> legs) {}
