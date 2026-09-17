package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ItineraryRepository extends JpaRepository<ItineraryEntity, UUID> {

    Optional<ItineraryEntity> findByDrivingAdultIdAndLegAndMemberSetKey(
            UUID drivingAdultId, CalendarRouteLeg leg, String memberSetKey);

    List<ItineraryEntity> findByDrivingAdultId(UUID drivingAdultId);

    List<ItineraryEntity> findByItemSourceAndItemId(LeaveByItemSource itemSource, UUID itemId);

    List<ItineraryEntity> findByMembersTokenContaining(String tokenFragment);

    void deleteByDrivingAdultIdAndLegAndMemberSetKey(
            UUID drivingAdultId, CalendarRouteLeg leg, String memberSetKey);

    void deleteByDrivingAdultId(UUID drivingAdultId);
}
