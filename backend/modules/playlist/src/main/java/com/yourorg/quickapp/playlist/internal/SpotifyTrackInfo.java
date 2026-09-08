package com.yourorg.quickapp.playlist.internal;

/** One track from a Spotify playlist (for merge UI). */
record SpotifyTrackInfo(String title, String artist, int durationSec, String uri) {}
