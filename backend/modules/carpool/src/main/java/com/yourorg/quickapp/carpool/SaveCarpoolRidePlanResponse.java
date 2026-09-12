package com.yourorg.quickapp.carpool;

import java.util.List;

public record SaveCarpoolRidePlanResponse(
        List<CarpoolRideLegResponse> ownLegs, CarpoolRideResponse ownRequest) {}
