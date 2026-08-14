package com.yourorg.quickapp.carpool.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "carpool_join_requests")
class CarpoolJoinRequestEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "requested_by_adult_id", nullable = false)
    private UUID requestedByAdultId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CarpoolJoinRequestEntity() {}

    CarpoolJoinRequestEntity(
            UUID id, UUID spaceId, UUID circleId, UUID requestedByAdultId, Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.circleId = circleId;
        this.requestedByAdultId = requestedByAdultId;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID spaceId() {
        return spaceId;
    }

    UUID circleId() {
        return circleId;
    }

    UUID requestedByAdultId() {
        return requestedByAdultId;
    }
}
