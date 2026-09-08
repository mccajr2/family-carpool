package com.yourorg.quickapp.playlist.internal;

/** Tokens returned by Spotify's token endpoint (authorize code or refresh). */
record SpotifyTokenResponse(
        String accessToken, String refreshToken, int expiresInSeconds) {}
