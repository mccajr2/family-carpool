package com.yourorg.quickapp.playlist;

import java.util.UUID;

/** Attending kid on a confirmed ride, supplied by calendar composition. */
public record RidePlaylistAttendingKid(UUID kidId, String displayName, String inviteLabel) {}
