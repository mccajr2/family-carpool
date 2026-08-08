package com.yourorg.quickapp.auth.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_sessions")
class AuthSessionEntity {

    @Id
    private UUID id;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 128)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuthSessionEntity() {}

    AuthSessionEntity(
            UUID id, UUID adultId, String tokenHash, Instant expiresAt, Instant createdAt) {
        this.id = id;
        this.adultId = adultId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID adultId() {
        return adultId;
    }

    Instant expiresAt() {
        return expiresAt;
    }

    Instant revokedAt() {
        return revokedAt;
    }

    void revoke(Instant at) {
        this.revokedAt = at;
    }
}
