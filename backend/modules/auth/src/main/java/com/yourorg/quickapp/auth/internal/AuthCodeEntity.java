package com.yourorg.quickapp.auth.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_codes")
class AuthCodeEntity {

    @Id
    private UUID id;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "code_hash", nullable = false, length = 128)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuthCodeEntity() {}

    AuthCodeEntity(UUID id, String email, String codeHash, Instant expiresAt, Instant createdAt) {
        this.id = id;
        this.email = email;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    String email() {
        return email;
    }

    String codeHash() {
        return codeHash;
    }

    Instant expiresAt() {
        return expiresAt;
    }

    Instant consumedAt() {
        return consumedAt;
    }

    void consume(Instant at) {
        this.consumedAt = at;
    }
}
