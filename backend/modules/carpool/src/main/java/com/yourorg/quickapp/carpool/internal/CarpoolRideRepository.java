package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolFulfillmentStatus;
import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface CarpoolRideRepository extends JpaRepository<CarpoolRideEntity, UUID> {

    Optional<CarpoolRideEntity> findByIdAndSpaceId(UUID id, UUID spaceId);

    List<CarpoolRideEntity> findBySpaceIdAndEventKeyInAndStatus(
            UUID spaceId, Collection<String> eventKeys, CarpoolFulfillmentStatus status);

    List<CarpoolRideEntity> findBySpaceIdInAndEventKeyAndStatus(
            Collection<UUID> spaceIds, String eventKey, CarpoolFulfillmentStatus status);

    List<CarpoolRideEntity> findBySpaceIdInAndEventKeyAndDrivingCircleIdAndStatus(
            Collection<UUID> spaceIds,
            String eventKey,
            UUID drivingCircleId,
            CarpoolFulfillmentStatus status);

    List<CarpoolRideEntity> findBySpaceIdInAndEventKeyAndDriverAdultIdAndStatus(
            Collection<UUID> spaceIds,
            String eventKey,
            UUID driverAdultId,
            CarpoolFulfillmentStatus status);

    boolean existsBySpaceIdAndEventKeyAndVehicleIdAndLegAndStatus(
            UUID spaceId,
            String eventKey,
            UUID vehicleId,
            CarpoolNeededLeg leg,
            CarpoolFulfillmentStatus status);

    @Query(
            """
            select case when count(r) > 0 then true else false end
            from CarpoolRideEntity r
            where r.spaceId = :spaceId
              and r.eventKey = :eventKey
              and r.leg = :leg
              and r.status = :status
              and :requestId member of r.passengerRequestIds
            """)
    boolean existsActivePassengerAssignment(
            @Param("spaceId") UUID spaceId,
            @Param("eventKey") String eventKey,
            @Param("leg") CarpoolNeededLeg leg,
            @Param("status") CarpoolFulfillmentStatus status,
            @Param("requestId") UUID requestId);
}
