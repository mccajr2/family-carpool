package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface DriveBlockOverrideRepository extends JpaRepository<DriveBlockOverrideEntity, UUID> {

    List<DriveBlockOverrideEntity> findByAdultIdOrderByCreatedAtAsc(UUID adultId);

    Optional<DriveBlockOverrideEntity>
            findByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                    UUID adultId,
                    CarpoolLegKind leg,
                    CalendarItemSource leftItemSource,
                    UUID leftItemId,
                    CalendarItemSource rightItemSource,
                    UUID rightItemId);

    long deleteByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
            UUID adultId,
            CarpoolLegKind leg,
            CalendarItemSource leftItemSource,
            UUID leftItemId,
            CalendarItemSource rightItemSource,
            UUID rightItemId);
}
