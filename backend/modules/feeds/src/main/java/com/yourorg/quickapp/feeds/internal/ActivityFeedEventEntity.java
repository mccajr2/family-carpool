package com.yourorg.quickapp.feeds.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "activity_feed_events")
class ActivityFeedEventEntity {

    @Id
    private UUID id;

    @Column(name = "feed_id", nullable = false)
    private UUID feedId;

    @Column(name = "uid", length = 255)
    private String uid;

    @Column(name = "summary", nullable = false, length = 500)
    private String summary;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "location", length = 500)
    private String location;

    protected ActivityFeedEventEntity() {}

    ActivityFeedEventEntity(
            UUID id,
            UUID feedId,
            String uid,
            String summary,
            Instant startsAt,
            Instant endsAt,
            String location) {
        this.id = id;
        this.feedId = feedId;
        this.uid = uid;
        this.summary = summary;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.location = location;
    }

    UUID id() {
        return id;
    }

    UUID feedId() {
        return feedId;
    }

    String uid() {
        return uid;
    }

    String summary() {
        return summary;
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
}
