package com.yourorg.quickapp.playlist.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "spotify_oauth_states")
class SpotifyOAuthStateEntity {

    @Id
    @Column(length = 64)
    private String state;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SpotifyOAuthStateEntity() {}

    SpotifyOAuthStateEntity(String state, UUID adultId, Instant expiresAt, Instant createdAt) {
        this.state = state;
        this.adultId = adultId;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    String state() {
        return state;
    }

    UUID adultId() {
        return adultId;
    }

    Instant expiresAt() {
        return expiresAt;
    }
}
