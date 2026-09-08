package com.yourorg.quickapp.playlist.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "spotify_connections")
class SpotifyConnectionEntity {

    @Id
    @Column(name = "adult_id")
    private UUID adultId;

    @Column(name = "spotify_user_id", nullable = false, length = 128)
    private String spotifyUserId;

    @Column(name = "access_token_ciphertext", nullable = false, columnDefinition = "TEXT")
    private String accessTokenCiphertext;

    @Column(name = "refresh_token_ciphertext", nullable = false, columnDefinition = "TEXT")
    private String refreshTokenCiphertext;

    @Column(name = "access_token_expires_at", nullable = false)
    private Instant accessTokenExpiresAt;

    /** Reused private "Carpool merge" playlist on the adult's Spotify account. */
    @Column(name = "merge_playlist_id", length = 128)
    private String mergePlaylistId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SpotifyConnectionEntity() {}

    SpotifyConnectionEntity(
            UUID adultId,
            String spotifyUserId,
            String accessTokenCiphertext,
            String refreshTokenCiphertext,
            Instant accessTokenExpiresAt,
            Instant createdAt) {
        this.adultId = adultId;
        this.spotifyUserId = spotifyUserId;
        this.accessTokenCiphertext = accessTokenCiphertext;
        this.refreshTokenCiphertext = refreshTokenCiphertext;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    UUID adultId() {
        return adultId;
    }

    String spotifyUserId() {
        return spotifyUserId;
    }

    String accessTokenCiphertext() {
        return accessTokenCiphertext;
    }

    String refreshTokenCiphertext() {
        return refreshTokenCiphertext;
    }

    Instant accessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    String mergePlaylistId() {
        return mergePlaylistId;
    }

    void setMergePlaylistId(String mergePlaylistId) {
        this.mergePlaylistId = mergePlaylistId;
    }

    void replaceCredentials(
            String spotifyUserId,
            String accessTokenCiphertext,
            String refreshTokenCiphertext,
            Instant accessTokenExpiresAt,
            Instant updatedAt) {
        if (!this.spotifyUserId.equals(spotifyUserId)) {
            this.mergePlaylistId = null;
        }
        this.spotifyUserId = spotifyUserId;
        this.accessTokenCiphertext = accessTokenCiphertext;
        this.refreshTokenCiphertext = refreshTokenCiphertext;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.updatedAt = updatedAt;
    }

    void updateTokens(
            String accessTokenCiphertext,
            String refreshTokenCiphertext,
            Instant accessTokenExpiresAt,
            Instant updatedAt) {
        this.accessTokenCiphertext = accessTokenCiphertext;
        this.refreshTokenCiphertext = refreshTokenCiphertext;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.updatedAt = updatedAt;
    }
}
