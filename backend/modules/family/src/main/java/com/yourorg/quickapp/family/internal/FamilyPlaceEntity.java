package com.yourorg.quickapp.family.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "family_places")
class FamilyPlaceEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    @Column(name = "name_normalized", nullable = false, length = 80)
    private String nameNormalized;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FamilyPlaceEntity() {}

    FamilyPlaceEntity(
            UUID id,
            UUID circleId,
            String name,
            String nameNormalized,
            String address,
            Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.name = name;
        this.nameNormalized = nameNormalized;
        this.address = address;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    String name() {
        return name;
    }

    String nameNormalized() {
        return nameNormalized;
    }

    String address() {
        return address;
    }

    Double latitude() {
        return latitude;
    }

    Double longitude() {
        return longitude;
    }

    void setName(String name, String nameNormalized) {
        this.name = name;
        this.nameNormalized = nameNormalized;
    }

    void setAddress(String address) {
        this.address = address;
    }

    void setCoordinates(Double latitude, Double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }
}
