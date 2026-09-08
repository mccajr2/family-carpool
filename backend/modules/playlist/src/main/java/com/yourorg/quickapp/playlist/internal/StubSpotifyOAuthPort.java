package com.yourorg.quickapp.playlist.internal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Deterministic Spotify OAuth for tests / offline. Codes containing {@code fail}
 * throw; refresh tokens containing {@code expire} rotate to a new access token.
 */
@Component
@ConditionalOnProperty(name = "app.spotify.oauth-provider", havingValue = "stub")
class StubSpotifyOAuthPort implements SpotifyOAuthPort {

    static final String ACCESS_TOKEN = "stub-access-token";
    static final String REFRESH_TOKEN = "stub-refresh-token";
    static final String USER_ID = "stub-spotify-user";
    static final String REFRESHED_ACCESS_TOKEN = "stub-refreshed-access-token";

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
}
