package com.yourorg.quickapp.leaveby.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "leaveby_route_cache")
class RouteCacheEntity {

    @Id
    @Column(name = "route_key", nullable = false, length = 80)
    private String routeKey;

    @Column(name = "duration_seconds", nullable = false)
    private double durationSeconds;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected RouteCacheEntity() {}

    RouteCacheEntity(String routeKey, double durationSeconds, Instant fetchedAt) {
        this.routeKey = routeKey;
        this.durationSeconds = durationSeconds;
        this.fetchedAt = fetchedAt;
    }

    String routeKey() {
        return routeKey;
    }

    double durationSeconds() {
        return durationSeconds;
    }

    Instant fetchedAt() {
        return fetchedAt;
    }
}
