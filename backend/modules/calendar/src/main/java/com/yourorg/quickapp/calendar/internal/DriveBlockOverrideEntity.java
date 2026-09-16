package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "calendar_drive_block_overrides")
class DriveBlockOverrideEntity {

    @Id
    private UUID id;

    @Column(name = "adult_id", nullable = false)
    private UUID adultId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private CarpoolLegKind leg;

    @Enumerated(EnumType.STRING)
    @Column(name = "left_item_source", nullable = false, length = 16)
    private CalendarItemSource leftItemSource;

    @Column(name = "left_item_id", nullable = false)
    private UUID leftItemId;

    @Enumerated(EnumType.STRING)
    @Column(name = "right_item_source", nullable = false, length = 16)
    private CalendarItemSource rightItemSource;

    @Column(name = "right_item_id", nullable = false)
    private UUID rightItemId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DriveBlockOverrideAction action;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DriveBlockOverrideEntity() {}

    DriveBlockOverrideEntity(
            UUID id,
            UUID adultId,
            CarpoolLegKind leg,
            CalendarItemSource leftItemSource,
            UUID leftItemId,
            CalendarItemSource rightItemSource,
            UUID rightItemId,
            DriveBlockOverrideAction action,
            Instant createdAt) {
        this.id = id;
        this.adultId = adultId;
        this.leg = leg;
        this.leftItemSource = leftItemSource;
        this.leftItemId = leftItemId;
        this.rightItemSource = rightItemSource;
        this.rightItemId = rightItemId;
        this.action = action;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID adultId() {
        return adultId;
    }

    CarpoolLegKind leg() {
        return leg;
    }

    CalendarItemSource leftItemSource() {
        return leftItemSource;
    }

    UUID leftItemId() {
        return leftItemId;
    }

    CalendarItemSource rightItemSource() {
        return rightItemSource;
    }

    UUID rightItemId() {
        return rightItemId;
    }

    DriveBlockOverrideAction action() {
        return action;
    }

    Instant createdAt() {
        return createdAt;
    }

    void setAction(DriveBlockOverrideAction action, Instant createdAt) {
        this.action = action;
        this.createdAt = createdAt;
    }
}
