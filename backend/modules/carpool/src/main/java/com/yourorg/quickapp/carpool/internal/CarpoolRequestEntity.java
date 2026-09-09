package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
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
@Table(name = "carpool_requests")
class CarpoolRequestEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "event_key", nullable = false, length = 1280)
    private String eventKey;

    @Column(name = "kid_id", nullable = false)
    private UUID kidId;

    @Column(name = "kid_first_name", nullable = false, length = 80)
    private String kidFirstName;

    @Column(name = "requesting_circle_id", nullable = false)
    private UUID requestingCircleId;

    @Column(name = "created_by_adult_id", nullable = false)
    private UUID createdByAdultId;

    @Column(name = "pickup_place_name", nullable = false, length = 80)
    private String pickupPlaceName;

    @Column(name = "pickup_address", nullable = false, length = 255)
    private String pickupAddress;

    @Column(name = "meet_point_to", length = 255)
    private String meetPointTo;

    @Column(name = "meet_point_from", length = 255)
    private String meetPointFrom;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "carpool_request_legs_needed",
            joinColumns = @JoinColumn(name = "request_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "leg", nullable = false, length = 8)
    private Set<CarpoolNeededLeg> legsNeeded = new LinkedHashSet<>();

    protected CarpoolRequestEntity() {}

    CarpoolRequestEntity(
            UUID id,
            UUID spaceId,
            String eventKey,
            UUID kidId,
            String kidFirstName,
            UUID requestingCircleId,
            UUID createdByAdultId,
            String pickupPlaceName,
            String pickupAddress,
            Set<CarpoolNeededLeg> legsNeeded,
            Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.eventKey = eventKey;
        this.kidId = kidId;
        this.kidFirstName = kidFirstName;
        this.requestingCircleId = requestingCircleId;
        this.createdByAdultId = createdByAdultId;
        this.pickupPlaceName = pickupPlaceName;
        this.pickupAddress = pickupAddress;
        this.legsNeeded = new LinkedHashSet<>(legsNeeded);
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

    UUID kidId() {
        return kidId;
    }

    String kidFirstName() {
        return kidFirstName;
    }

    UUID requestingCircleId() {
        return requestingCircleId;
    }

    UUID createdByAdultId() {
        return createdByAdultId;
    }

    String pickupPlaceName() {
        return pickupPlaceName;
    }

    String pickupAddress() {
        return pickupAddress;
    }

    Set<CarpoolNeededLeg> legsNeeded() {
        return Set.copyOf(legsNeeded);
    }

    Instant createdAt() {
        return createdAt;
    }

    void replaceLegsNeeded(Set<CarpoolNeededLeg> nextLegs) {
        this.legsNeeded = new LinkedHashSet<>(nextLegs);
    }
}
