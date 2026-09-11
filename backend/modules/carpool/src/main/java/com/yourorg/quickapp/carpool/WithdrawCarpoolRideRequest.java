package com.yourorg.quickapp.carpool;

import java.util.List;

public record WithdrawCarpoolRideRequest(List<CarpoolLegKind> legs) {}
