package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.UUID;

@Embeddable
class RideLegSlot {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 8)
    private CarpoolLegKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "phase", nullable = false, length = 32)
    private CarpoolLegPhase phase;

    @Column(name = "assignee_adult_id")
    private UUID assigneeAdultId;

    @Column(name = "assignee_circle_id")
    private UUID assigneeCircleId;

    protected RideLegSlot() {}

    RideLegSlot(
            CarpoolLegKind kind,
            CarpoolLegPhase phase,
            UUID assigneeAdultId,
            UUID assigneeCircleId) {
        this.kind = kind;
        this.phase = phase;
        this.assigneeAdultId = assigneeAdultId;
        this.assigneeCircleId = assigneeCircleId;
    }

    static RideLegSlot needsRide(CarpoolLegKind kind) {
        return new RideLegSlot(kind, CarpoolLegPhase.NEEDS_RIDE, null, null);
    }

    static RideLegSlot askedTeam(CarpoolLegKind kind) {
        return new RideLegSlot(kind, CarpoolLegPhase.ASKED_TEAM, null, null);
    }

    static RideLegSlot confirmed(
            CarpoolLegKind kind, UUID assigneeAdultId, UUID assigneeCircleId) {
        return new RideLegSlot(
                kind, CarpoolLegPhase.CONFIRMED, assigneeAdultId, assigneeCircleId);
    }

    CarpoolLegKind kind() {
        return kind;
    }

    CarpoolLegPhase phase() {
        return phase;
    }

    UUID assigneeAdultId() {
        return assigneeAdultId;
    }

    UUID assigneeCircleId() {
        return assigneeCircleId;
    }

    void setPhase(CarpoolLegPhase phase) {
        this.phase = phase;
    }

    void setAssignee(UUID assigneeAdultId, UUID assigneeCircleId) {
        this.assigneeAdultId = assigneeAdultId;
        this.assigneeCircleId = assigneeCircleId;
    }

    void clearAssignee() {
        this.assigneeAdultId = null;
        this.assigneeCircleId = null;
    }
}
