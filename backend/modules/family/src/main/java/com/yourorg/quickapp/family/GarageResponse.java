package com.yourorg.quickapp.family;

import java.util.List;

public record GarageResponse(
        List<GarageMemberDrivesResponse> members, List<VehicleResponse> vehicles) {}
