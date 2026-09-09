package com.yourorg.quickapp.carpool.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "carpool_request_passes")
class CarpoolRequestPassEntity {

    @Id
    private UUID id;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CarpoolRequestPassEntity() {}

    CarpoolRequestPassEntity(UUID id, UUID requestId, UUID adultId, Instant createdAt) {
        this.id = id;
        this.requestId = requestId;
        this.adultId = adultId;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID requestId() {
        return requestId;
    }

    UUID adultId() {
        return adultId;
    }

    Instant createdAt() {
        return createdAt;
    }
}
