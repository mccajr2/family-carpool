package com.yourorg.quickapp.carpool.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "carpool_spaces")
class CarpoolSpaceEntity {

    @Id
    private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "normalized_source_url", nullable = false, length = 2048)
    private String normalizedSourceUrl;

    @Column(name = "invite_code", nullable = false, length = 16)
    private String inviteCode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CarpoolSpaceEntity() {}

    CarpoolSpaceEntity(
            UUID id,
            String name,
            String normalizedSourceUrl,
            String inviteCode,
            Instant createdAt) {
        this.id = id;
        this.name = name;
        this.normalizedSourceUrl = normalizedSourceUrl;
        this.inviteCode = inviteCode;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    String name() {
        return name;
    }

    String normalizedSourceUrl() {
        return normalizedSourceUrl;
    }

    String inviteCode() {
        return inviteCode;
    }

    void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }
}
