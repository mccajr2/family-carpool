package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "carpool_ride_requests")
class CarpoolRideRequestEntity {

    @Id
    private UUID id;

    @Column(name = "space_id", nullable = false)
    private UUID spaceId;

    @Column(name = "event_key", nullable = false, length = 1280)
    private String eventKey;

    @Column(name = "requesting_circle_id", nullable = false)
    private UUID requestingCircleId;

    @Column(name = "requested_by_adult_id", nullable = false)
    private UUID requestedByAdultId;

    @Column(name = "pickup_place_name", nullable = false, length = 80)
    private String pickupPlaceName;

    @Column(name = "pickup_address", nullable = false, length = 255)
    private String pickupAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CarpoolRideStatus status;

    @Column(name = "accepted_by_adult_id")
    private UUID acceptedByAdultId;

    @Column(name = "accepting_circle_id")
    private UUID acceptingCircleId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "carpool_ride_request_kids",
            joinColumns = @JoinColumn(name = "ride_id"))
    @OrderColumn(name = "sort_order")
    private List<RideKidSnapshot> kids = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "carpool_ride_request_legs",
            joinColumns = @JoinColumn(name = "ride_id"))
    @OrderColumn(name = "sort_order")
    private List<RideLegSlot> legs = new ArrayList<>();

    protected CarpoolRideRequestEntity() {}

    CarpoolRideRequestEntity(
            UUID id,
            UUID spaceId,
            String eventKey,
            UUID requestingCircleId,
            UUID requestedByAdultId,
            String pickupPlaceName,
            String pickupAddress,
            List<RideKidSnapshot> kids,
            Set<CarpoolLegKind> askedLegs,
            Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.eventKey = eventKey;
        this.requestingCircleId = requestingCircleId;
        this.requestedByAdultId = requestedByAdultId;
        this.pickupPlaceName = pickupPlaceName;
        this.pickupAddress = pickupAddress;
        this.status = CarpoolRideStatus.PENDING;
        this.kids = new ArrayList<>(kids);
        this.legs = initialAskedLegs(askedLegs);
        this.createdAt = createdAt;
    }

    private static List<RideLegSlot> initialAskedLegs(Set<CarpoolLegKind> askedLegs) {
        Set<CarpoolLegKind> asked =
                askedLegs == null || askedLegs.isEmpty()
                        ? EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM)
                        : EnumSet.copyOf(askedLegs);
        List<RideLegSlot> slots = new ArrayList<>(2);
        slots.add(
                asked.contains(CarpoolLegKind.TO)
                        ? RideLegSlot.askedTeam(CarpoolLegKind.TO)
                        : RideLegSlot.needsRide(CarpoolLegKind.TO));
        slots.add(
                asked.contains(CarpoolLegKind.FROM)
                        ? RideLegSlot.askedTeam(CarpoolLegKind.FROM)
                        : RideLegSlot.needsRide(CarpoolLegKind.FROM));
        return slots;
    }

    UUID id() {
        return id;
    }

    UUID spaceId() {
        return spaceId;
    }

    String eventKey() {
        return eventKey;
    }

    UUID requestingCircleId() {
        return requestingCircleId;
    }

    UUID requestedByAdultId() {
        return requestedByAdultId;
    }

    String pickupPlaceName() {
        return pickupPlaceName;
    }

    String pickupAddress() {
        return pickupAddress;
    }

    CarpoolRideStatus status() {
        return status;
    }

    UUID acceptedByAdultId() {
        return acceptedByAdultId;
    }

    UUID acceptingCircleId() {
        return acceptingCircleId;
    }

    List<RideKidSnapshot> kids() {
        return List.copyOf(kids);
    }

    List<RideLegSlot> legs() {
        return List.copyOf(legs);
    }

    int seats() {
        return kids.size();
    }

    void accept(UUID acceptedByAdultId, UUID acceptingCircleId) {
        this.status = CarpoolRideStatus.ACCEPTED;
        this.acceptedByAdultId = acceptedByAdultId;
        this.acceptingCircleId = acceptingCircleId;
        for (RideLegSlot leg : legs) {
            if (leg.phase() == CarpoolLegPhase.ASKED_TEAM) {
                leg.setPhase(CarpoolLegPhase.CONFIRMED);
                leg.setAssignee(acceptedByAdultId, acceptingCircleId);
            }
        }
    }

    /**
     * Clears asked/confirmed legs to NEEDS_RIDE. Returns true when the request
     * should become CANCELLED (no asked/confirmed legs remain).
     */
    boolean cancelLegs(Set<CarpoolLegKind> kinds) {
        for (RideLegSlot leg : legs) {
            if (kinds.contains(leg.kind())
                    && (leg.phase() == CarpoolLegPhase.ASKED_TEAM
                            || leg.phase() == CarpoolLegPhase.CONFIRMED)) {
                leg.setPhase(CarpoolLegPhase.NEEDS_RIDE);
                leg.clearAssignee();
            }
        }
        syncRollupAfterClear();
        return status == CarpoolRideStatus.CANCELLED;
    }

    /**
     * Reopens confirmed team legs to ASKED_TEAM. Returns true when no confirmed
     * team legs remain (status becomes PENDING).
     */
    boolean withdrawLegs(Set<CarpoolLegKind> kinds) {
        for (RideLegSlot leg : legs) {
            if (kinds.contains(leg.kind()) && leg.phase() == CarpoolLegPhase.CONFIRMED) {
                leg.setPhase(CarpoolLegPhase.ASKED_TEAM);
                leg.clearAssignee();
            }
        }
        syncRollupAfterWithdraw();
        return status == CarpoolRideStatus.PENDING;
    }

    void cancel() {
        cancelLegs(EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM));
    }

    void withdraw() {
        withdrawLegs(EnumSet.of(CarpoolLegKind.TO, CarpoolLegKind.FROM));
    }

    /** Distinct assignee adult ids on CONFIRMED legs (nulls ignored). */
    Set<UUID> confirmedAssigneeAdultIds() {
        Set<UUID> ids = new java.util.HashSet<>();
        for (RideLegSlot leg : legs) {
            if (leg.phase() == CarpoolLegPhase.CONFIRMED && leg.assigneeAdultId() != null) {
                ids.add(leg.assigneeAdultId());
            }
        }
        return ids;
    }

    boolean assigneesMatchForCombinedClear() {
        return confirmedAssigneeAdultIds().size() <= 1;
    }

    private void syncRollupAfterClear() {
        boolean anyAsked = false;
        boolean anyConfirmed = false;
        UUID confirmedAdult = null;
        UUID confirmedCircle = null;
        for (RideLegSlot leg : legs) {
            if (leg.phase() == CarpoolLegPhase.ASKED_TEAM) {
                anyAsked = true;
            } else if (leg.phase() == CarpoolLegPhase.CONFIRMED) {
                anyConfirmed = true;
                if (confirmedAdult == null) {
                    confirmedAdult = leg.assigneeAdultId();
                    confirmedCircle = leg.assigneeCircleId();
                }
            }
        }
        if (anyConfirmed) {
            this.status = CarpoolRideStatus.ACCEPTED;
            this.acceptedByAdultId = confirmedAdult;
            this.acceptingCircleId = confirmedCircle;
        } else if (anyAsked) {
            this.status = CarpoolRideStatus.PENDING;
            this.acceptedByAdultId = null;
            this.acceptingCircleId = null;
        } else {
            this.status = CarpoolRideStatus.CANCELLED;
            this.acceptedByAdultId = null;
            this.acceptingCircleId = null;
        }
    }

    private void syncRollupAfterWithdraw() {
        boolean anyConfirmed = false;
        UUID confirmedAdult = null;
        UUID confirmedCircle = null;
        for (RideLegSlot leg : legs) {
            if (leg.phase() == CarpoolLegPhase.CONFIRMED) {
                anyConfirmed = true;
                if (confirmedAdult == null) {
                    confirmedAdult = leg.assigneeAdultId();
                    confirmedCircle = leg.assigneeCircleId();
                }
            }
        }
        if (anyConfirmed) {
            this.status = CarpoolRideStatus.ACCEPTED;
            this.acceptedByAdultId = confirmedAdult;
            this.acceptingCircleId = confirmedCircle;
        } else {
            this.status = CarpoolRideStatus.PENDING;
            this.acceptedByAdultId = null;
            this.acceptingCircleId = null;
        }
    }

    RideLegSlot leg(CarpoolLegKind kind) {
        for (RideLegSlot leg : legs) {
            if (leg.kind() == kind) {
                return leg;
            }
        }
        throw new IllegalStateException("Missing leg slot " + kind);
    }
}
