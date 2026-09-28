package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.UUID;

/** Ask-template leg on a standing arrangement (no assignee — primary lives on the row). */
@Embeddable
class StandingRideAskLegSlot {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 8)
    private CarpoolLegKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "phase", nullable = false, length = 32)
    private CarpoolLegPhase phase;

    @Enumerated(EnumType.STRING)
    @Column(name = "meet_side", nullable = false, length = 16)
    private CarpoolMeetSide meetSide = CarpoolMeetSide.REQUESTER;

    @Column(name = "place_id")
    private UUID placeId;

    @Column(name = "one_time_address", length = 255)
    private String oneTimeAddress;

    @Column(name = "place_name", length = 80)
    private String placeName;

    @Column(name = "place_address", length = 255)
    private String placeAddress;

    protected StandingRideAskLegSlot() {}

    StandingRideAskLegSlot(
            CarpoolLegKind kind,
            CarpoolLegPhase phase,
            CarpoolMeetSide meetSide,
            UUID placeId,
            String oneTimeAddress,
            String placeName,
            String placeAddress) {
        this.kind = kind;
        this.phase = phase;
        this.meetSide = meetSide == null ? CarpoolMeetSide.REQUESTER : meetSide;
        this.placeId = placeId;
        this.oneTimeAddress = oneTimeAddress;
        this.placeName = placeName;
        this.placeAddress = placeAddress;
    }

    CarpoolLegKind kind() {
        return kind;
    }

    CarpoolLegPhase phase() {
        return phase;
    }

    CarpoolMeetSide meetSide() {
        return meetSide == null ? CarpoolMeetSide.REQUESTER : meetSide;
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
}
