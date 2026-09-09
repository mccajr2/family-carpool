package com.yourorg.quickapp.carpool.internal;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CarpoolRequestPassRepository extends JpaRepository<CarpoolRequestPassEntity, UUID> {

    boolean existsByRequestIdAndAdultId(UUID requestId, UUID adultId);

    List<CarpoolRequestPassEntity> findByRequestIdIn(Collection<UUID> requestIds);

    void deleteByRequestId(UUID requestId);

    void deleteByRequestIdIn(Collection<UUID> requestIds);
}
