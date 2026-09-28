package com.yourorg.quickapp.carpool.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "standing_ride_arrangement_passes")
class StandingRideArrangementPassEntity {

    @Id
    private UUID id;

    @Column(name = "arrangement_id", nullable = false)
    private UUID arrangementId;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected StandingRideArrangementPassEntity() {}

    StandingRideArrangementPassEntity(
            UUID id, UUID arrangementId, UUID adultId, Instant createdAt) {
        this.id = id;
        this.arrangementId = arrangementId;
        this.adultId = adultId;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID arrangementId() {
        return arrangementId;
    }

    UUID adultId() {
        return adultId;
    }

    Instant createdAt() {
        return createdAt;
    }
}
