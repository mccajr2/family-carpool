package com.yourorg.quickapp.feeds.internal;

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
@Table(name = "activity_feeds")
class ActivityFeedEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    @Column(name = "source_url", nullable = false, length = 2048)
    private String sourceUrl;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @Column(name = "last_sync_error", length = 500)
    private String lastSyncError;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "activity_feed_kids", joinColumns = @JoinColumn(name = "feed_id"))
    @Column(name = "kid_id")
    private Set<UUID> kidIds = new HashSet<>();

    protected ActivityFeedEntity() {}

    ActivityFeedEntity(
            UUID id, UUID circleId, String name, String sourceUrl, Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.name = name;
        this.sourceUrl = sourceUrl;
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

    String sourceUrl() {
        return sourceUrl;
    }

    Instant lastSyncedAt() {
        return lastSyncedAt;
    }

    String lastSyncError() {
        return lastSyncError;
    }

    Set<UUID> kidIds() {
        return kidIds;
    }

    void setName(String name) {
        this.name = name;
    }

    void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    void setKidIds(Set<UUID> kidIds) {
        this.kidIds = new HashSet<>(kidIds);
    }

    void markSyncSuccess(Instant at) {
        this.lastSyncedAt = at;
        this.lastSyncError = null;
    }

    void markSyncFailure(String error) {
        this.lastSyncError = truncate(error, 500);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
