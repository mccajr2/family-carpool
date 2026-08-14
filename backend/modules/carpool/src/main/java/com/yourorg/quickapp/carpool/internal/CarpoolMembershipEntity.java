package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolSpaceMembership;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "carpool_space_memberships")
class CarpoolMembershipEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CarpoolSpaceMembership membership;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CarpoolMembershipEntity() {}

    CarpoolMembershipEntity(
            UUID id,
            UUID spaceId,
            UUID circleId,
            CarpoolSpaceMembership membership,
            Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.circleId = circleId;
        this.membership = membership;
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

    CarpoolSpaceMembership membership() {
        return membership;
    }
}
