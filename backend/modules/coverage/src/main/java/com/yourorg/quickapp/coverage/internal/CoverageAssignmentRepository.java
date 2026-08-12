package com.yourorg.quickapp.coverage.internal;

import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CoverageAssignmentRepository extends JpaRepository<CoverageAssignmentEntity, UUID> {

    List<CoverageAssignmentEntity> findByCircleIdAndItemSourceAndItemIdOrderByCreatedAtAsc(
            UUID circleId, CoverageItemSource itemSource, UUID itemId);

    List<CoverageAssignmentEntity> findByCircleIdAndItemSourceAndItemIdInOrderByCreatedAtAsc(
            UUID circleId, CoverageItemSource itemSource, Collection<UUID> itemIds);

    Optional<CoverageAssignmentEntity>
            findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                    UUID circleId,
                    CoverageItemSource itemSource,
                    UUID itemId,
                    UUID coveringAdultId,
                    Collection<CoverageStatus> statuses);

    List<CoverageAssignmentEntity> findByCircleIdAndItemSourceAndItemIdAndStatusIn(
            UUID circleId,
            CoverageItemSource itemSource,
            UUID itemId,
            Collection<CoverageStatus> statuses);
}
