package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
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
@Table(name = "leaveby_itineraries")
class ItineraryEntity {

    @Id
    private UUID id;

    @Column(name = "driving_adult_id", nullable = false)
    private UUID drivingAdultId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_source", nullable = false, length = 16)
    private LeaveByItemSource itemSource;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private CalendarRouteStatus status;

    @Column(name = "reason", length = 64)
    private String reason;

    @Column(name = "buffer_minutes", nullable = false)
    private int bufferMinutes;

    @Column(name = "stop_fingerprint", nullable = false, length = 64)
    private String stopFingerprint;

    @Column(name = "stops_json", nullable = false, columnDefinition = "TEXT")
    private String stopsJson;

    @Column(name = "leg_minutes_json", nullable = false, columnDefinition = "TEXT")
    private String legMinutesJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ItineraryEntity() {}

    ItineraryEntity(
            UUID id,
            UUID drivingAdultId,
            LeaveByItemSource itemSource,
            UUID itemId,
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            String stopFingerprint,
            String stopsJson,
            String legMinutesJson,
            Instant createdAt,
            Instant updatedAt) {
        this.id = id;
        this.drivingAdultId = drivingAdultId;
        this.itemSource = itemSource;
        this.itemId = itemId;
        this.status = status;
        this.reason = reason;
        this.bufferMinutes = bufferMinutes;
        this.stopFingerprint = stopFingerprint;
        this.stopsJson = stopsJson;
        this.legMinutesJson = legMinutesJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    UUID id() {
        return id;
    }

    UUID drivingAdultId() {
        return drivingAdultId;
    }

    LeaveByItemSource itemSource() {
        return itemSource;
    }

    UUID itemId() {
        return itemId;
    }

    CalendarRouteStatus status() {
        return status;
    }

    String reason() {
        return reason;
    }

    int bufferMinutes() {
        return bufferMinutes;
    }

    String stopFingerprint() {
        return stopFingerprint;
    }

    String stopsJson() {
        return stopsJson;
    }

    String legMinutesJson() {
        return legMinutesJson;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    void replace(
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            String stopFingerprint,
            String stopsJson,
            String legMinutesJson,
            Instant updatedAt) {
        this.status = status;
        this.reason = reason;
        this.bufferMinutes = bufferMinutes;
        this.stopFingerprint = stopFingerprint;
        this.stopsJson = stopsJson;
        this.legMinutesJson = legMinutesJson;
        this.updatedAt = updatedAt;
    }
}
