package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.FamilyRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "family_memberships")
class FamilyMembershipEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FamilyRole role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "default_leave_from_place_id")
    private UUID defaultLeaveFromPlaceId;

    @Column(nullable = false)
    private boolean drives = true;

    protected FamilyMembershipEntity() {}

    FamilyMembershipEntity(UUID id, UUID circleId, UUID adultId, FamilyRole role, Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.adultId = adultId;
        this.role = role;
        this.createdAt = createdAt;
    }

    UUID circleId() {
        return circleId;
    }

    UUID adultId() {
        return adultId;
    }

    FamilyRole role() {
        return role;
    }

    UUID defaultLeaveFromPlaceId() {
        return defaultLeaveFromPlaceId;
    }

    boolean drives() {
        return drives;
    }

    void setRole(FamilyRole role) {
        this.role = role;
    }

    void setDefaultLeaveFromPlaceId(UUID defaultLeaveFromPlaceId) {
        this.defaultLeaveFromPlaceId = defaultLeaveFromPlaceId;
    }

    void setDrives(boolean drives) {
        this.drives = drives;
    }
}
