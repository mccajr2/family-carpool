package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import com.yourorg.quickapp.events.ManualEventRideConflictException;
import com.yourorg.quickapp.events.ManualEventRideGuard;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ManualEventRideGuardImpl implements ManualEventRideGuard {

    private static final List<CarpoolRideStatus> SPACE_BLOCKING =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED);
    private static final List<CarpoolRideStatus> ACTIVE_PLANS =
            List.of(CarpoolRideStatus.PENDING, CarpoolRideStatus.ACCEPTED, CarpoolRideStatus.PLAN);

    private final CarpoolMembershipRepository memberships;
    private final CarpoolRideRequestRepository rides;
    private final CarpoolRidePassRepository passes;

    ManualEventRideGuardImpl(
            CarpoolMembershipRepository memberships,
            CarpoolRideRequestRepository rides,
            CarpoolRidePassRepository passes) {
        this.memberships = memberships;
        this.rides = rides;
        this.passes = passes;
    }

    @Override
    @Transactional(readOnly = true)
    public void requireNoActiveSpaceRides(UUID circleId, String eventKey) {
        if (eventKey == null || eventKey.isBlank()) {
            return;
        }
        List<UUID> spaceIds =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(CarpoolMembershipEntity::spaceId)
                        .toList();
        if (spaceIds.isEmpty()) {
            return;
        }
        List<CarpoolRideRequestEntity> blocking =
                rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                        spaceIds, eventKey.trim(), circleId, SPACE_BLOCKING);
        if (!blocking.isEmpty()) {
            throw new ManualEventRideConflictException(
                    "Cannot change team link while an active team ride exists for this event");
        }
    }

    @Override
    @Transactional
    public void cancelActivePlans(UUID circleId, String eventKey) {
        if (eventKey == null || eventKey.isBlank()) {
            return;
        }
        String key = eventKey.trim();
        List<UUID> spaceIds =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(CarpoolMembershipEntity::spaceId)
                        .toList();
        List<CarpoolRideRequestEntity> all = new ArrayList<>();
        if (!spaceIds.isEmpty()) {
            all.addAll(
                    rides.findBySpaceIdInAndEventKeyAndRequestingCircleIdAndStatusIn(
                            spaceIds, key, circleId, ACTIVE_PLANS));
        }
        all.addAll(
                rides.findByRequestingCircleIdAndEventKeyAndSpaceIdIsNullAndStatusIn(
                        circleId, key, ACTIVE_PLANS));
        for (CarpoolRideRequestEntity ride : all) {
            ride.cancel();
            rides.save(ride);
            passes.deleteByRideId(ride.id());
        }
    }
}
