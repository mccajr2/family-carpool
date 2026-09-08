package com.yourorg.quickapp.playlist.internal;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic Spotify OAuth + catalog for tests / offline. Codes containing
 * {@code fail} throw; refresh tokens containing {@code fail} throw.
 */
@Component
@ConditionalOnProperty(name = "app.spotify.oauth-provider", havingValue = "stub")
class StubSpotifyOAuthPort implements SpotifyOAuthPort {

    static final String ACCESS_TOKEN = "stub-access-token";
    static final String REFRESH_TOKEN = "stub-refresh-token";
    static final String USER_ID = "stub-spotify-user";
    static final String REFRESHED_ACCESS_TOKEN = "stub-refreshed-access-token";

    static final SpotifyPlaylistInfo PLAYLIST_A =
            new SpotifyPlaylistInfo(
                    "stub-playlist-a",
                    "Sam gameday",
                    "https://open.spotify.com/playlist/stub-playlist-a",
                    12);
    static final SpotifyPlaylistInfo PLAYLIST_B =
            new SpotifyPlaylistInfo(
                    "stub-playlist-b",
                    "Jordan warmup",
                    "https://open.spotify.com/playlist/stub-playlist-b",
                    8);

    @Override
    public SpotifyTokenResponse exchangeAuthorizationCode(String code) {
        if (code != null && code.toLowerCase().contains("fail")) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY, "Stub Spotify code exchange failed");
        }
        return new SpotifyTokenResponse(ACCESS_TOKEN, REFRESH_TOKEN, 3600);
    }

    @Override
    public SpotifyTokenResponse refreshAccessToken(String refreshToken) {
        if (refreshToken != null && refreshToken.toLowerCase().contains("fail")) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY, "Stub Spotify refresh failed");
        }
        return new SpotifyTokenResponse(REFRESHED_ACCESS_TOKEN, refreshToken, 3600);
    }

    @Override
    public String fetchCurrentUserId(String accessToken) {
        return USER_ID;
    }

    @Override
    public List<SpotifyPlaylistInfo> listPlaylists(String accessToken) {
        return List.of(PLAYLIST_A, PLAYLIST_B);
    }

    @Override
    public SpotifyPlaylistInfo getPlaylist(String accessToken, String playlistId) {
        if (PLAYLIST_A.id().equals(playlistId)) {
            return PLAYLIST_A;
        }
        if (PLAYLIST_B.id().equals(playlistId)) {
            return PLAYLIST_B;
        }
        throw new PlaylistException(
                org.springframework.http.HttpStatus.NOT_FOUND, "Stub playlist not found");
    }

    @Override
    public List<SpotifyTrackInfo> listPlaylistTracks(String accessToken, String playlistId) {
        if (PLAYLIST_A.id().equals(playlistId)) {
            return List.of(
                    new SpotifyTrackInfo("Sunset Drive", "Coastline", 198, "spotify:track:a1"),
                    new SpotifyTrackInfo("Neon Static", "Halfway House", 221, "spotify:track:a2"),
                    new SpotifyTrackInfo("Overtime", "Pace Car", 176, "spotify:track:a3"));
        }
        if (PLAYLIST_B.id().equals(playlistId)) {
            return List.of(
                    new SpotifyTrackInfo("Warmup Lap", "Pace Car", 190, "spotify:track:b1"),
                    new SpotifyTrackInfo("Blue Line", "Coastline", 205, "spotify:track:b2"));
        }
        return List.of();
    }
}
