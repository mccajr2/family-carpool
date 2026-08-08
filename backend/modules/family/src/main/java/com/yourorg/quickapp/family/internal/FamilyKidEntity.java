package com.yourorg.quickapp.family.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "family_kids")
class FamilyKidEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FamilyKidEntity() {}

    FamilyKidEntity(UUID id, UUID circleId, String displayName, Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.displayName = displayName;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    String displayName() {
        return displayName;
    }

    void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
