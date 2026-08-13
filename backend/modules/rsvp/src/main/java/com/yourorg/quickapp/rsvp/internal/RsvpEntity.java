package com.yourorg.quickapp.rsvp.internal;

import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "calendar_rsvps")
class RsvpEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_source", nullable = false, length = 16)
    private RsvpItemSource itemSource;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "kid_id", nullable = false)
    private UUID kidId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RsvpStatus status;

    @Column(name = "updated_by_adult_id", nullable = false)
    private UUID updatedByAdultId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected RsvpEntity() {}

    RsvpEntity(
            UUID id,
            UUID circleId,
            RsvpItemSource itemSource,
            UUID itemId,
            UUID kidId,
            RsvpStatus status,
            UUID updatedByAdultId,
            Instant createdAt,
            Instant updatedAt) {
        this.id = id;
        this.circleId = circleId;
        this.itemSource = itemSource;
        this.itemId = itemId;
        this.kidId = kidId;
        this.status = status;
        this.updatedByAdultId = updatedByAdultId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    RsvpItemSource itemSource() {
        return itemSource;
    }

    UUID itemId() {
        return itemId;
    }

    UUID kidId() {
        return kidId;
    }

    RsvpStatus status() {
        return status;
    }

    UUID updatedByAdultId() {
        return updatedByAdultId;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    void update(RsvpStatus status, UUID updatedByAdultId, Instant updatedAt) {
        this.status = status;
        this.updatedByAdultId = updatedByAdultId;
        this.updatedAt = updatedAt;
    }
}
