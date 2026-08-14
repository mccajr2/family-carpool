package com.yourorg.quickapp.carpool;

import com.yourorg.quickapp.family.FamilyRole;
import java.util.List;

public record CarpoolSummaryResponse(
        FamilyRole circleRole,
        List<CarpoolFeedStatusResponse> feeds,
        List<CarpoolSpaceResponse> spaces) {}
