package com.yourorg.quickapp.calendar.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface StandingBlockTemplateRepository
        extends JpaRepository<StandingBlockTemplateEntity, UUID> {

    List<StandingBlockTemplateEntity> findByCircleIdOrderByCreatedAtAsc(UUID circleId);

    Optional<StandingBlockTemplateEntity> findByCircleIdAndFingerprintSetKey(
            UUID circleId, String fingerprintSetKey);

    Optional<StandingBlockTemplateEntity> findByIdAndCircleId(UUID id, UUID circleId);

    long deleteByCircleIdAndFingerprintSetKey(UUID circleId, String fingerprintSetKey);

    long deleteByIdAndCircleId(UUID id, UUID circleId);
}
