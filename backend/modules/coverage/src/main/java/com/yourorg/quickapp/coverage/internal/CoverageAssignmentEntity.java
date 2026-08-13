package com.yourorg.quickapp.coverage.internal;

import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
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
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "coverage_assignments")
class CoverageAssignmentEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_source", nullable = false, length = 16)
    private CoverageItemSource itemSource;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "covering_adult_id", nullable = false)
    private UUID coveringAdultId;

    @Column(name = "assigned_by_adult_id", nullable = false)
    private UUID assignedByAdultId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CoverageStatus status;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "coverage_assignment_kids",
            joinColumns = @JoinColumn(name = "assignment_id"))
    @Column(name = "kid_id", nullable = false)
    private Set<UUID> kidIds = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CoverageAssignmentEntity() {}

    CoverageAssignmentEntity(
            UUID id,
            UUID circleId,
            CoverageItemSource itemSource,
            UUID itemId,
            UUID coveringAdultId,
            UUID assignedByAdultId,
            CoverageStatus status,
            Set<UUID> kidIds,
            Instant createdAt,
            Instant updatedAt) {
        this.id = id;
        this.circleId = circleId;
        this.itemSource = itemSource;
        this.itemId = itemId;
        this.coveringAdultId = coveringAdultId;
        this.assignedByAdultId = assignedByAdultId;
        this.status = status;
        this.kidIds = new HashSet<>(kidIds);
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    CoverageItemSource itemSource() {
        return itemSource;
    }

    UUID itemId() {
        return itemId;
    }

    UUID coveringAdultId() {
        return coveringAdultId;
    }

    UUID assignedByAdultId() {
        return assignedByAdultId;
    }

    CoverageStatus status() {
        return status;
    }

    Set<UUID> kidIds() {
        return Set.copyOf(kidIds);
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    void reassign(
            UUID coveringAdultId,
            UUID assignedByAdultId,
            CoverageStatus status,
            Set<UUID> kidIds,
            Instant updatedAt) {
        this.coveringAdultId = coveringAdultId;
        this.assignedByAdultId = assignedByAdultId;
        this.status = status;
        this.kidIds = new HashSet<>(kidIds);
        this.updatedAt = updatedAt;
    }

    void setStatus(CoverageStatus status, Instant updatedAt) {
        this.status = status;
        this.updatedAt = updatedAt;
    }

    void setKids(Set<UUID> kidIds, Instant updatedAt) {
        this.kidIds = new HashSet<>(kidIds);
        this.updatedAt = updatedAt;
    }
}
