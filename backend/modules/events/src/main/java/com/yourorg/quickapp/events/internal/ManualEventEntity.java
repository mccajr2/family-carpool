package com.yourorg.quickapp.events.internal;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "manual_events")
class ManualEventEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "location", length = 500)
    private String location;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "manual_event_kids", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "kid_id")
    private Set<UUID> kidIds = new HashSet<>();

    protected ManualEventEntity() {}

    ManualEventEntity(
            UUID id,
            UUID circleId,
            String title,
            Instant startsAt,
            Instant endsAt,
            String location,
            Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.title = title;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.location = location;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    String title() {
        return title;
    }

    Instant startsAt() {
        return startsAt;
    }

    Instant endsAt() {
        return endsAt;
    }

    String location() {
        return location;
    }

    Set<UUID> kidIds() {
        return kidIds;
    }

    void setTitle(String title) {
        this.title = title;
    }

    void setStartsAt(Instant startsAt) {
        this.startsAt = startsAt;
    }

    void setEndsAt(Instant endsAt) {
        this.endsAt = endsAt;
    }

    void setLocation(String location) {
        this.location = location;
    }

    void setKidIds(Set<UUID> kidIds) {
        this.kidIds = new HashSet<>(kidIds);
    }
}
