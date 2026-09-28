package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

interface StandingRideArrangementPassRepository
        extends JpaRepository<StandingRideArrangementPassEntity, UUID> {

    boolean existsByArrangementIdAndAdultId(UUID arrangementId, UUID adultId);

    List<StandingRideArrangementPassEntity> findByArrangementIdIn(Collection<UUID> arrangementIds);

    @Transactional
    void deleteByArrangementId(UUID arrangementId);
}
