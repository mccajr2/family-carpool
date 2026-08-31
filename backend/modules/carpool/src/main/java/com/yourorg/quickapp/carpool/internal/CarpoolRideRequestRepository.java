package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolRideStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolRideRequestRepository extends JpaRepository<CarpoolRideRequestEntity, UUID> {

    Optional<CarpoolRideRequestEntity> findByIdAndSpaceId(UUID id, UUID spaceId);

    List<CarpoolRideRequestEntity> findBySpaceIdAndEventKeyInAndStatusIn(
            UUID spaceId, Collection<String> eventKeys, Collection<CarpoolRideStatus> statuses);

    boolean existsBySpaceIdAndEventKeyAndRequestingCircleIdAndStatusIn(
            UUID spaceId,
            String eventKey,
            UUID requestingCircleId,
            Collection<CarpoolRideStatus> statuses);

    boolean existsBySpaceIdAndEventKeyAndVehicleIdAndStatus(
            UUID spaceId, String eventKey, UUID vehicleId, CarpoolRideStatus status);

    List<CarpoolRideRequestEntity> findBySpaceIdAndEventKeyAndRequestingCircleIdAndStatus(
            UUID spaceId, String eventKey, UUID requestingCircleId, CarpoolRideStatus status);

    List<CarpoolRideRequestEntity> findBySpaceIdInAndEventKeyAndAcceptingCircleIdAndStatus(
            Collection<UUID> spaceIds,
            String eventKey,
            UUID acceptingCircleId,
            CarpoolRideStatus status);
}
