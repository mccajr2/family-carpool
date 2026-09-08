package com.yourorg.quickapp.playlist;

import java.util.UUID;

public record KidPlaylistDesignationResponse(
        UUID kidId,
        String kidDisplayName,
        String spotifyPlaylistId,
        String playlistName,
        String playlistUrl,
        Integer trackCount) {}
