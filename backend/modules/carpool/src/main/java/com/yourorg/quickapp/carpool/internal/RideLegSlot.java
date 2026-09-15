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

    /** Named circle place; mutually exclusive with {@link #oneTimeAddress}. */
    @Column(name = "place_id")
    private UUID placeId;

    /** One-time free-text address; mutually exclusive with {@link #placeId}. */
    @Column(name = "one_time_address", length = 255)
    private String oneTimeAddress;

    /** Write-time snapshot of family-side place name (Default / named / one-time). */
    @Column(name = "place_name", length = 80)
    private String placeName;

    /** Write-time snapshot of family-side place address. */
    @Column(name = "place_address", length = 255)
    private String placeAddress;

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

    static RideLegSlot waitingHousehold(CarpoolLegKind kind, UUID assigneeAdultId) {
        return new RideLegSlot(
                kind, CarpoolLegPhase.WAITING_HOUSEHOLD, assigneeAdultId, null);
    }

    static RideLegSlot householdConfirmed(CarpoolLegKind kind, UUID assigneeAdultId) {
        return new RideLegSlot(kind, CarpoolLegPhase.CONFIRMED, assigneeAdultId, null);
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

    UUID placeId() {
        return placeId;
    }

    String oneTimeAddress() {
        return oneTimeAddress;
    }

    String placeName() {
        return placeName;
    }

    String placeAddress() {
        return placeAddress;
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

    /**
     * Stores family-side place mode + write-time display snapshot. Default mode
     * keeps {@code placeId} and {@code oneTimeAddress} null.
     */
    void setFamilyPlace(
            UUID placeId, String oneTimeAddress, String placeName, String placeAddress) {
        this.placeId = placeId;
        this.oneTimeAddress = oneTimeAddress;
        this.placeName = placeName;
        this.placeAddress = placeAddress;
    }

    void clearFamilyPlace() {
        this.placeId = null;
        this.oneTimeAddress = null;
        this.placeName = null;
        this.placeAddress = null;
    }

    /** Grouping key: Default / named place id / one-time address (not snapshots). */
    String placeOutcomeKey() {
        if (placeId != null) {
            return "P:" + placeId;
        }
        if (oneTimeAddress != null && !oneTimeAddress.isBlank()) {
            return "A:" + oneTimeAddress;
        }
        return "D";
    }
}
