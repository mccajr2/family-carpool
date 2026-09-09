package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
import com.yourorg.quickapp.carpool.CarpoolFulfillmentStatus;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "carpool_rides")
class CarpoolRideEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "event_key", nullable = false, length = 1280)
    private String eventKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "leg", nullable = false, length = 8)
    private CarpoolNeededLeg leg;

    @Column(name = "driver_adult_id", nullable = false)
    private UUID driverAdultId;

    @Column(name = "driving_circle_id", nullable = false)
    private UUID drivingCircleId;

    @Column(name = "vehicle_id", nullable = false)
    private UUID vehicleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CarpoolFulfillmentStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "carpool_ride_passengers",
            joinColumns = @JoinColumn(name = "ride_id"))
    @Column(name = "request_id", nullable = false)
    private Set<UUID> passengerRequestIds = new LinkedHashSet<>();

    protected CarpoolRideEntity() {}

    CarpoolRideEntity(
            UUID id,
            UUID spaceId,
            String eventKey,
            CarpoolNeededLeg leg,
            UUID driverAdultId,
            UUID drivingCircleId,
            UUID vehicleId,
            Set<UUID> passengerRequestIds,
            Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.eventKey = eventKey;
        this.leg = leg;
        this.driverAdultId = driverAdultId;
        this.drivingCircleId = drivingCircleId;
        this.vehicleId = vehicleId;
        this.status = CarpoolFulfillmentStatus.ACTIVE;
        this.passengerRequestIds = new LinkedHashSet<>(passengerRequestIds);
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID spaceId() {
        return spaceId;
    }

    String eventKey() {
        return eventKey;
    }

    CarpoolNeededLeg leg() {
        return leg;
    }

    UUID driverAdultId() {
        return driverAdultId;
    }

    UUID drivingCircleId() {
        return drivingCircleId;
    }

    UUID vehicleId() {
        return vehicleId;
    }

    CarpoolFulfillmentStatus status() {
        return status;
    }

    Set<UUID> passengerRequestIds() {
        return Set.copyOf(passengerRequestIds);
    }

    boolean isActive() {
        return status == CarpoolFulfillmentStatus.ACTIVE;
    }

    void cancel() {
        this.status = CarpoolFulfillmentStatus.CANCELLED;
    }

    void withdraw() {
        this.status = CarpoolFulfillmentStatus.WITHDRAWN;
    }
}
