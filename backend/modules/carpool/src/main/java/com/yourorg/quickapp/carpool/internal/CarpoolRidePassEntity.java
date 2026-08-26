package com.yourorg.quickapp.carpool.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "carpool_ride_passes")
class CarpoolRidePassEntity {

    @Id
    private UUID id;

    @Column(name = "ride_id", nullable = false)
    private UUID rideId;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CarpoolRidePassEntity() {}

    CarpoolRidePassEntity(UUID id, UUID rideId, UUID adultId, Instant createdAt) {
        this.id = id;
        this.rideId = rideId;
        this.adultId = adultId;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID rideId() {
        return rideId;
    }

    UUID adultId() {
        return adultId;
    }

    Instant createdAt() {
        return createdAt;
    }
}
