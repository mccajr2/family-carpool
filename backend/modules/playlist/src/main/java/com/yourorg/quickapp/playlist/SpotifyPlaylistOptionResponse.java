package com.yourorg.quickapp.playlist;

public record SpotifyPlaylistOptionResponse(
        String id, String name, String url, int trackCount) {}
