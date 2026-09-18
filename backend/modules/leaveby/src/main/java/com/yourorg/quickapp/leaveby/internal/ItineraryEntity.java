package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
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
    @Column(name = "leg", nullable = false, length = 8)
    private CalendarRouteLeg leg;

    @Column(name = "member_set_key", nullable = false, length = 64)
    private String memberSetKey;

    @Column(name = "members_token", nullable = false, columnDefinition = "TEXT")
    private String membersToken;

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

    /** Named place home-side override; mutually exclusive with {@code homeAddress}. */
    @Column(name = "home_place_id")
    private UUID homePlaceId;

    /** One-time home-side override; mutually exclusive with {@code homePlaceId}. */
    @Column(name = "home_address", length = 255)
    private String homeAddress;

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
            CalendarRouteLeg leg,
            String memberSetKey,
            String membersToken,
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
        this.leg = leg == null ? CalendarRouteLeg.TO : leg;
        this.memberSetKey = memberSetKey;
        this.membersToken = membersToken == null ? "" : membersToken;
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

    CalendarRouteLeg leg() {
        return leg;
    }

    String memberSetKey() {
        return memberSetKey;
    }

    String membersToken() {
        return membersToken;
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

    UUID homePlaceId() {
        return homePlaceId;
    }

    String homeAddress() {
        return homeAddress;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    /**
     * Persist Leaving-from / Returning-to triad. Both null clears to Default.
     * Does not touch stop fingerprint — callers must rebuild after a change.
     */
    void setHomeSideOverride(UUID homePlaceId, String homeAddress, Instant updatedAt) {
        this.homePlaceId = homePlaceId;
        this.homeAddress = homeAddress;
        this.updatedAt = updatedAt;
    }

    void replace(
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            String stopFingerprint,
            String stopsJson,
            String legMinutesJson,
            LeaveByItemSource itemSource,
            UUID itemId,
            String membersToken,
            Instant updatedAt) {
        this.status = status;
        this.reason = reason;
        this.bufferMinutes = bufferMinutes;
        this.stopFingerprint = stopFingerprint;
        this.stopsJson = stopsJson;
        this.legMinutesJson = legMinutesJson;
        this.itemSource = itemSource;
        this.itemId = itemId;
        this.membersToken = membersToken == null ? "" : membersToken;
        this.updatedAt = updatedAt;
        // homePlaceId / homeAddress intentionally preserved across rebuilds
    }
}
