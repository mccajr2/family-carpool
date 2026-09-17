package com.yourorg.quickapp.leaveby;

import java.util.UUID;

/** Named or one-time leave-from place for Route middle assembly. */
public record LeaveFromPlaceDto(UUID placeId, String placeName, String address) {}
