package com.yourorg.quickapp.playlist.internal;

import java.util.List;

/**
 * Spotify Authorization Code + refresh + current-user lookup + playlist
 * catalog. Implementations must not leak tokens into logs.
 */
interface SpotifyOAuthPort {

    SpotifyTokenResponse exchangeAuthorizationCode(String code);

    /**
     * Refresh the access token. When Spotify omits {@code refresh_token}, the
     * returned refresh token is the same as {@code refreshToken}.
     */
    SpotifyTokenResponse refreshAccessToken(String refreshToken);

    String fetchCurrentUserId(String accessToken);

    /** Current user's playlists (first page; enough for dogfood picker). */
    List<SpotifyPlaylistInfo> listPlaylists(String accessToken);

    SpotifyPlaylistInfo getPlaylist(String accessToken, String playlistId);
}
