package com.yourorg.quickapp.playlist.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.spotify")
public record SpotifyProperties(
        String clientId,
        String clientSecret,
        String redirectUri,
        String successRedirectUri,
        /** Exactly 32 UTF-8 bytes for AES-256-GCM. */
        String tokenEncryptionKey,
        String authorizeUrl,
        String tokenUrl,
        String apiBaseUrl,
        String scopes) {}
