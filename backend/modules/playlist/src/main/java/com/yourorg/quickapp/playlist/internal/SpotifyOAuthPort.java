package com.yourorg.quickapp.playlist.internal;

/**
 * Spotify Authorization Code + refresh + current-user lookup. Implementations
 * must not leak tokens into logs.
 */
interface SpotifyOAuthPort {

    SpotifyTokenResponse exchangeAuthorizationCode(String code);

    /**
     * Refresh the access token. When Spotify omits {@code refresh_token}, the
     * returned refresh token is the same as {@code refreshToken}.
     */
    SpotifyTokenResponse refreshAccessToken(String refreshToken);

    String fetchCurrentUserId(String accessToken);
}
