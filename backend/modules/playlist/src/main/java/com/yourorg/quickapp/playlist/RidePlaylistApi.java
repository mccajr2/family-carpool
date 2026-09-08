package com.yourorg.quickapp.playlist;

import java.util.List;
import java.util.UUID;

/**
 * Enrich attending kids with designation + Spotify tracks for the Playlist tab.
 * Calendar resolves who is in the car; this module owns Spotify HTTP +
 * designation storage.
 */
public interface RidePlaylistApi {

    /**
     * One rider per attending kid. Connected when any designation exists for
     * that kid; prefers the viewer's own designation when multiple adults
     * designated the same kid. Track fetch uses the designating adult's token
     * and soft-fails to empty tracks (metadata still shown).
     */
    List<RidePlaylistRiderDto> enrichRiders(
            UUID viewerAdultId, List<RidePlaylistAttendingKid> attendingKids);
}
