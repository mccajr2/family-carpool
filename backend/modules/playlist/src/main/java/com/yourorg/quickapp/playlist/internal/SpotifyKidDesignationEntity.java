package com.yourorg.quickapp.playlist.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "spotify_kid_designations")
@IdClass(SpotifyKidDesignationEntity.Pk.class)
class SpotifyKidDesignationEntity {

    @Id
    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Id
    @Column(name = "kid_id", nullable = false)
    private UUID kidId;

    @Column(name = "spotify_playlist_id", nullable = false, length = 128)
    private String spotifyPlaylistId;

    @Column(name = "playlist_name", nullable = false, length = 200)
    private String playlistName;

    @Column(name = "playlist_url", nullable = false, length = 512)
    private String playlistUrl;

    @Column(name = "track_count")
    private Integer trackCount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SpotifyKidDesignationEntity() {}

    SpotifyKidDesignationEntity(
            UUID adultId,
            UUID kidId,
            String spotifyPlaylistId,
            String playlistName,
            String playlistUrl,
            Integer trackCount,
            Instant updatedAt) {
        this.adultId = adultId;
        this.kidId = kidId;
        this.spotifyPlaylistId = spotifyPlaylistId;
        this.playlistName = playlistName;
        this.playlistUrl = playlistUrl;
        this.trackCount = trackCount;
        this.updatedAt = updatedAt;
    }

    UUID adultId() {
        return adultId;
    }

    UUID kidId() {
        return kidId;
    }

    String spotifyPlaylistId() {
        return spotifyPlaylistId;
    }

    String playlistName() {
        return playlistName;
    }

    String playlistUrl() {
        return playlistUrl;
    }

    Integer trackCount() {
        return trackCount;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    void replacePlaylist(
            String spotifyPlaylistId,
            String playlistName,
            String playlistUrl,
            Integer trackCount,
            Instant updatedAt) {
        this.spotifyPlaylistId = spotifyPlaylistId;
        this.playlistName = playlistName;
        this.playlistUrl = playlistUrl;
        this.trackCount = trackCount;
        this.updatedAt = updatedAt;
    }

    static final class Pk implements Serializable {
        private UUID adultId;
        private UUID kidId;

        protected Pk() {}

        Pk(UUID adultId, UUID kidId) {
            this.adultId = adultId;
            this.kidId = kidId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof Pk pk)) {
                return false;
            }
            return Objects.equals(adultId, pk.adultId) && Objects.equals(kidId, pk.kidId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(adultId, kidId);
        }
    }
}
