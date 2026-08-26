package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolRidePassRepository extends JpaRepository<CarpoolRidePassEntity, UUID> {

    boolean existsByRideIdAndAdultId(UUID rideId, UUID adultId);

    List<CarpoolRidePassEntity> findByRideIdIn(Collection<UUID> rideIds);

    List<CarpoolRidePassEntity> findByRideIdInAndAdultId(Collection<UUID> rideIds, UUID adultId);

    void deleteByRideId(UUID rideId);
}
