package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ItineraryRepository extends JpaRepository<ItineraryEntity, UUID> {

    Optional<ItineraryEntity> findByDrivingAdultIdAndItemSourceAndItemId(
            UUID drivingAdultId, LeaveByItemSource itemSource, UUID itemId);

    List<ItineraryEntity> findByItemSourceAndItemId(LeaveByItemSource itemSource, UUID itemId);

    void deleteByDrivingAdultIdAndItemSourceAndItemId(
            UUID drivingAdultId, LeaveByItemSource itemSource, UUID itemId);

    void deleteByItemSourceAndItemId(LeaveByItemSource itemSource, UUID itemId);
}
