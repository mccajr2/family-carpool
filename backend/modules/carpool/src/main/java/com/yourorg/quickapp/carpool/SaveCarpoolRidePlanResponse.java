package com.yourorg.quickapp.carpool;

import java.util.List;

public record SaveCarpoolRidePlanResponse(
        List<CarpoolRideResponse> ownRequests,
        List<CarpoolRideLegResponse> ownLegs,
        CarpoolRideResponse ownRequest) {}
