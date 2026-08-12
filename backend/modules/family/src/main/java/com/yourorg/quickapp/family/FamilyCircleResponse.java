package com.yourorg.quickapp.family;

import java.util.List;
import java.util.UUID;

public record FamilyCircleResponse(
        UUID id,
        String name,
        FamilyRole role,
        List<FamilyMemberResponse> members,
        List<KidResponse> kids,
        List<PlaceResponse> places,
        UUID defaultLeaveFromPlaceId,
        String defaultLeaveFromPlaceName) {}
