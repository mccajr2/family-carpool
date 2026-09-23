package com.yourorg.quickapp.calendar.internal;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "standing_block_templates")
class StandingBlockTemplateEntity {

    @Id
    private UUID id;

    @Column(name = "circle_id", nullable = false)
    private UUID circleId;

    @Column(name = "fingerprint_set_key", nullable = false, columnDefinition = "TEXT")
    private String fingerprintSetKey;

    @Column(name = "created_by_adult_id", nullable = false)
    private UUID createdByAdultId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(
            mappedBy = "template",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.EAGER)
    @OrderBy("position ASC")
    private List<StandingBlockTemplateMemberEntity> members = new ArrayList<>();

    protected StandingBlockTemplateEntity() {}

    StandingBlockTemplateEntity(
            UUID id,
            UUID circleId,
            String fingerprintSetKey,
            UUID createdByAdultId,
            Instant createdAt) {
        this.id = id;
        this.circleId = circleId;
        this.fingerprintSetKey = fingerprintSetKey;
        this.createdByAdultId = createdByAdultId;
        this.createdAt = createdAt;
    }

    UUID id() {
        return id;
    }

    UUID circleId() {
        return circleId;
    }

    String fingerprintSetKey() {
        return fingerprintSetKey;
    }

    UUID createdByAdultId() {
        return createdByAdultId;
    }

    Instant createdAt() {
        return createdAt;
    }

    List<StandingBlockTemplateMemberEntity> members() {
        return members;
    }

    void replaceMembers(List<StandingBlockTemplateMemberEntity> next) {
        members.clear();
        for (StandingBlockTemplateMemberEntity member : next) {
            member.setTemplate(this);
            members.add(member);
        }
    }
}
