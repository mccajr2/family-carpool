package com.yourorg.quickapp.family.internal;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "family_vehicles")
class FamilyVehicleEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "owner_adult_id", nullable = false)
    private UUID ownerAdultId;

    @Column(name = "kept_at_place_id")
    private UUID keptAtPlaceId;

    @Column(nullable = false, length = 80)
    private String label;

    @Column(name = "label_normalized", nullable = false, length = 80)
    private String labelNormalized;

    @Column(nullable = false)
    private int year;

    @Column(nullable = false, length = 140)
    private String make;

    @Column(nullable = false, length = 140)
    private String model;

    @Column(nullable = false)
    private int seats;

    @Column(name = "suggested_seats")
    private Integer suggestedSeats;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "family_vehicle_drivers", joinColumns = @JoinColumn(name = "vehicle_id"))
    @Column(name = "adult_id", nullable = false)
    private Set<UUID> driverAdultIds = new LinkedHashSet<>();

    protected FamilyVehicleEntity() {}

    FamilyVehicleEntity(
            UUID id,
            UUID circleId,
            UUID ownerAdultId,
            String label,
            String labelNormalized,
            int year,
            String make,
            String model,
            int seats,
            Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.ownerAdultId = ownerAdultId;
        this.label = label;
        this.labelNormalized = labelNormalized;
        this.year = year;
        this.make = make;
        this.model = model;
        this.seats = seats;
        this.createdAt = createdAt;
        this.driverAdultIds.add(ownerAdultId);
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    UUID ownerAdultId() {
        return ownerAdultId;
    }

    UUID keptAtPlaceId() {
        return keptAtPlaceId;
    }

    String label() {
        return label;
    }

    int year() {
        return year;
    }

    String make() {
        return make;
    }

    String model() {
        return model;
    }

    int seats() {
        return seats;
    }

    Integer suggestedSeats() {
        return suggestedSeats;
    }

    Set<UUID> driverAdultIds() {
        return driverAdultIds;
    }

    void setLabel(String label, String labelNormalized) {
        this.label = label;
        this.labelNormalized = labelNormalized;
    }

    void setYear(int year) {
        this.year = year;
    }

    void setMake(String make) {
        this.make = make;
    }

    void setModel(String model) {
        this.model = model;
    }

    void setSeats(int seats) {
        this.seats = seats;
    }

    void setSuggestedSeats(Integer suggestedSeats) {
        this.suggestedSeats = suggestedSeats;
    }

    void setKeptAtPlaceId(UUID keptAtPlaceId) {
        this.keptAtPlaceId = keptAtPlaceId;
    }

    void setDriverAdultIds(Set<UUID> driverAdultIds) {
        this.driverAdultIds.clear();
        this.driverAdultIds.addAll(driverAdultIds);
    }
}
