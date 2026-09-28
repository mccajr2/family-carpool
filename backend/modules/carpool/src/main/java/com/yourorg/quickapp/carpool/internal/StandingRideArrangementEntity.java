package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import com.yourorg.quickapp.carpool.StandingRideAssignment;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "standing_ride_arrangements")
class StandingRideArrangementEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "requesting_circle_id", nullable = false)
    private UUID requestingCircleId;

    @Column(name = "requested_by_adult_id", nullable = false)
    private UUID requestedByAdultId;

    @Column(name = "feed_id", nullable = false)
    private UUID feedId;

    @Column(name = "day_of_week", nullable = false, length = 16)
    private String dayOfWeek;

    @Column(name = "minute_of_day", nullable = false)
    private int minuteOfDay;

    @Column(name = "normalized_location", nullable = false, length = 500)
    private String normalizedLocation;

    @Column(name = "fingerprint_encoded", nullable = false, columnDefinition = "TEXT")
    private String fingerprintEncoded;

    @Column(name = "time_zone", nullable = false, length = 64)
    private String timeZone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private StandingRideAssignment assignment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StandingRideArrangementStatus status;

    @Column(name = "primary_adult_id")
    private UUID primaryAdultId;

    @Column(name = "primary_circle_id")
    private UUID primaryCircleId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "standing_ride_arrangement_kids",
            joinColumns = @JoinColumn(name = "arrangement_id"))
    @OrderColumn(name = "sort_order")
    private List<RideKidSnapshot> kids = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "standing_ride_arrangement_legs",
            joinColumns = @JoinColumn(name = "arrangement_id"))
    @OrderColumn(name = "sort_order")
    private List<StandingRideAskLegSlot> legs = new ArrayList<>();

    protected StandingRideArrangementEntity() {}

    StandingRideArrangementEntity(
            UUID id,
            UUID spaceId,
            UUID requestingCircleId,
            UUID requestedByAdultId,
            UUID feedId,
            String dayOfWeek,
            int minuteOfDay,
            String normalizedLocation,
            String fingerprintEncoded,
            String timeZone,
            List<RideKidSnapshot> kids,
            List<StandingRideAskLegSlot> legs,
            Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.requestingCircleId = requestingCircleId;
        this.requestedByAdultId = requestedByAdultId;
        this.feedId = feedId;
        this.dayOfWeek = dayOfWeek;
        this.minuteOfDay = minuteOfDay;
        this.normalizedLocation = normalizedLocation;
        this.fingerprintEncoded = fingerprintEncoded;
        this.timeZone = timeZone;
        this.assignment = StandingRideAssignment.FIXED_PRIMARY;
        this.status = StandingRideArrangementStatus.OPEN;
        this.kids = new ArrayList<>(kids);
        this.legs = new ArrayList<>(legs);
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID spaceId() {
        return spaceId;
    }

    UUID requestingCircleId() {
        return requestingCircleId;
    }

    UUID requestedByAdultId() {
        return requestedByAdultId;
    }

    UUID feedId() {
        return feedId;
    }

    String dayOfWeek() {
        return dayOfWeek;
    }

    int minuteOfDay() {
        return minuteOfDay;
    }

    String normalizedLocation() {
        return normalizedLocation;
    }

    String fingerprintEncoded() {
        return fingerprintEncoded;
    }

    String timeZone() {
        return timeZone;
    }

    StandingRideAssignment assignment() {
        return assignment;
    }

    StandingRideArrangementStatus status() {
        return status;
    }

    UUID primaryAdultId() {
        return primaryAdultId;
    }

    UUID primaryCircleId() {
        return primaryCircleId;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant endedAt() {
        return endedAt;
    }

    List<RideKidSnapshot> kids() {
        return List.copyOf(kids);
    }

    List<StandingRideAskLegSlot> legs() {
        return List.copyOf(legs);
    }

    void activate(UUID primaryAdultId, UUID primaryCircleId) {
        if (status != StandingRideArrangementStatus.OPEN) {
            throw new IllegalStateException("only OPEN arrangements can become ACTIVE");
        }
        this.status = StandingRideArrangementStatus.ACTIVE;
        this.primaryAdultId = primaryAdultId;
        this.primaryCircleId = primaryCircleId;
    }

    void end(Instant endedAt) {
        if (status == StandingRideArrangementStatus.ENDED) {
            return;
        }
        this.status = StandingRideArrangementStatus.ENDED;
        this.primaryAdultId = null;
        this.primaryCircleId = null;
        this.endedAt = endedAt;
    }
}
