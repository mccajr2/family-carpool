package com.yourorg.quickapp.playlist;

import java.util.Optional;
import java.util.UUID;

/**
 * Public Spotify connection surface for other Modulith modules (playlist read /
 * open handoff) without touching playlist internals.
 */
public interface SpotifyConnectionApi {

    boolean isConnected(UUID adultId);

    void revoke(UUID adultId);

    /**
     * Valid access token for the adult, refreshing when near expiry. Empty when
     * the adult has no Spotify connection.
     */
    Optional<String> accessToken(UUID adultId);
}
