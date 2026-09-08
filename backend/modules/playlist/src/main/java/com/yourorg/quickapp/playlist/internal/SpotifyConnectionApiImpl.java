package com.yourorg.quickapp.playlist.internal;

import com.yourorg.quickapp.playlist.SpotifyConnectionApi;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
class SpotifyConnectionApiImpl implements SpotifyConnectionApi {

    private final SpotifyOAuthService oauthService;

    SpotifyConnectionApiImpl(SpotifyOAuthService oauthService) {
        this.oauthService = oauthService;
    }

    @Override
    public boolean isConnected(UUID adultId) {
        return oauthService.isConnected(adultId);
    }

    @Override
    public void revoke(UUID adultId) {
        oauthService.revoke(adultId);
    }

    @Override
    public Optional<String> accessToken(UUID adultId) {
        return oauthService.accessToken(adultId);
    }
}
