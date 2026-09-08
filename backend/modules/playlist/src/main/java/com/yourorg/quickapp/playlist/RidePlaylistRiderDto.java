package com.yourorg.quickapp.playlist;

import java.util.List;
import java.util.UUID;

/** One attending-kid tile for the Playlist tab. */
public record RidePlaylistRiderDto(
        UUID kidId,
        String kidDisplayName,
        boolean connected,
        UUID designatingAdultId,
        String spotifyPlaylistId,
        String playlistName,
        String playlistUrl,
        Integer trackCount,
        Integer durationSec,
        List<RidePlaylistTrackDto> tracks,
        RidePlaylistInviteContactDto inviteContact) {}
