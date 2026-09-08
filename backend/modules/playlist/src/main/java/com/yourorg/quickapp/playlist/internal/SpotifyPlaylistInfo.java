package com.yourorg.quickapp.playlist.internal;

/** Spotify playlist metadata used for designation and picker lists. */
record SpotifyPlaylistInfo(String id, String name, String url, int trackCount) {}
