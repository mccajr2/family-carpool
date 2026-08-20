package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolRideStatus;
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
@Table(name = "carpool_ride_requests")
class CarpoolRideRequestEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "event_key", nullable = false, length = 1280)
    private String eventKey;

    @Column(name = "requesting_circle_id", nullable = false)
    private UUID requestingCircleId;

    @Column(name = "requested_by_adult_id", nullable = false)
    private UUID requestedByAdultId;

    @Column(name = "pickup_place_name", nullable = false, length = 80)
    private String pickupPlaceName;

    @Column(name = "pickup_address", nullable = false, length = 255)
    private String pickupAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CarpoolRideStatus status;

    @Column(name = "accepted_by_adult_id")
    private UUID acceptedByAdultId;

    @Column(name = "accepting_circle_id")
    private UUID acceptingCircleId;

    @Column(name = "vehicle_id")
    private UUID vehicleId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "carpool_ride_request_kids",
            joinColumns = @JoinColumn(name = "ride_id"))
    @OrderColumn(name = "sort_order")
    private List<RideKidSnapshot> kids = new ArrayList<>();

    protected CarpoolRideRequestEntity() {}

    CarpoolRideRequestEntity(
            UUID id,
            UUID spaceId,
            String eventKey,
            UUID requestingCircleId,
            UUID requestedByAdultId,
            String pickupPlaceName,
            String pickupAddress,
            List<RideKidSnapshot> kids,
            Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.eventKey = eventKey;
        this.requestingCircleId = requestingCircleId;
        this.requestedByAdultId = requestedByAdultId;
        this.pickupPlaceName = pickupPlaceName;
        this.pickupAddress = pickupAddress;
        this.status = CarpoolRideStatus.PENDING;
        this.kids = new ArrayList<>(kids);
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

    UUID requestingCircleId() {
        return requestingCircleId;
    }

    UUID requestedByAdultId() {
        return requestedByAdultId;
    }

    String pickupPlaceName() {
        return pickupPlaceName;
    }

    String pickupAddress() {
        return pickupAddress;
    }

    CarpoolRideStatus status() {
        return status;
    }

    UUID acceptedByAdultId() {
        return acceptedByAdultId;
    }

    UUID acceptingCircleId() {
        return acceptingCircleId;
    }

    UUID vehicleId() {
        return vehicleId;
    }

    List<RideKidSnapshot> kids() {
        return List.copyOf(kids);
    }

    int seats() {
        return kids.size();
    }

    void accept(UUID acceptedByAdultId, UUID acceptingCircleId, UUID vehicleId) {
        this.status = CarpoolRideStatus.ACCEPTED;
        this.acceptedByAdultId = acceptedByAdultId;
        this.acceptingCircleId = acceptingCircleId;
        this.vehicleId = vehicleId;
    }

    void cancel() {
        this.status = CarpoolRideStatus.CANCELLED;
        this.acceptedByAdultId = null;
        this.acceptingCircleId = null;
        this.vehicleId = null;
    }

    void withdraw() {
        this.status = CarpoolRideStatus.PENDING;
        this.acceptedByAdultId = null;
        this.acceptingCircleId = null;
        this.vehicleId = null;
    }
}
