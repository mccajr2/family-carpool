package com.yourorg.quickapp.family.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "geocode_cache")
class GeocodeCacheEntity {

    @Id
    @Column(name = "address_normalized", nullable = false, length = 255)
    private String addressNormalized;

    @Column(name = "latitude", nullable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false)
    private double longitude;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected GeocodeCacheEntity() {}

    GeocodeCacheEntity(
            String addressNormalized, double latitude, double longitude, Instant fetchedAt) {
        this.addressNormalized = addressNormalized;
        this.latitude = latitude;
        this.longitude = longitude;
        this.fetchedAt = fetchedAt;
    }

    String addressNormalized() {
        return addressNormalized;
    }

    double latitude() {
        return latitude;
    }

    double longitude() {
        return longitude;
    }
}
