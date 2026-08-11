package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "calendar_leave_from")
class CalendarLeaveFromEntity {

    @Id
    private UUID id;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_source", nullable = false, length = 16)
    private LeaveByItemSource itemSource;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "place_id", nullable = false)
    private UUID placeId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CalendarLeaveFromEntity() {}

    CalendarLeaveFromEntity(
            UUID id,
            UUID adultId,
            LeaveByItemSource itemSource,
            UUID itemId,
            UUID placeId,
            Instant createdAt,
            Instant updatedAt) {
        this.id = id;
        this.adultId = adultId;
        this.itemSource = itemSource;
        this.itemId = itemId;
        this.placeId = placeId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    UUID id() {
        return id;
    }

    UUID adultId() {
        return adultId;
    }

    LeaveByItemSource itemSource() {
        return itemSource;
    }

    UUID itemId() {
        return itemId;
    }

    UUID placeId() {
        return placeId;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    void setPlaceId(UUID placeId, Instant updatedAt) {
        this.placeId = placeId;
        this.updatedAt = updatedAt;
    }
}
