package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface StandingRideArrangementPassRepository
        extends JpaRepository<StandingRideArrangementPassEntity, UUID> {

    boolean existsByArrangementIdAndAdultId(UUID arrangementId, UUID adultId);

    List<StandingRideArrangementPassEntity> findByArrangementIdIn(Collection<UUID> arrangementIds);

    void deleteByArrangementId(UUID arrangementId);
}
