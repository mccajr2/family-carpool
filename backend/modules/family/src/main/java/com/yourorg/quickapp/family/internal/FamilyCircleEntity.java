package com.yourorg.quickapp.family.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "family_circles")
class FamilyCircleEntity {

    @Id
    private UUID id;

    @Column(length = 80)
    private String name;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FamilyCircleEntity() {}

    FamilyCircleEntity(UUID id, String name, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    String name() {
        return name;
    }

    void setName(String name) {
        this.name = name;
    }
}
