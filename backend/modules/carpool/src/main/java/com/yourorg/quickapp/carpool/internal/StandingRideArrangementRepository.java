package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface StandingRideArrangementRepository
        extends JpaRepository<StandingRideArrangementEntity, UUID> {

    Optional<StandingRideArrangementEntity> findByIdAndSpaceId(UUID id, UUID spaceId);

    List<StandingRideArrangementEntity> findBySpaceIdOrderByCreatedAtAsc(UUID spaceId);

    List<StandingRideArrangementEntity> findBySpaceIdAndStatusInOrderByCreatedAtAsc(
            UUID spaceId, List<StandingRideArrangementStatus> statuses);

    Optional<StandingRideArrangementEntity>
            findBySpaceIdAndRequestingCircleIdAndFingerprintEncodedAndStatusIn(
                    UUID spaceId,
                    UUID requestingCircleId,
                    String fingerprintEncoded,
                    List<StandingRideArrangementStatus> statuses);
}
