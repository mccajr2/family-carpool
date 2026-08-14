package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

public record CarpoolSpaceResponse(
        UUID id,
        String name,
        CarpoolSpaceMembership membership,
        String inviteCode,
        UUID callerFeedId,
        List<CarpoolSpaceMemberResponse> members,
        List<CarpoolJoinRequestResponse> pendingRequests) {}
