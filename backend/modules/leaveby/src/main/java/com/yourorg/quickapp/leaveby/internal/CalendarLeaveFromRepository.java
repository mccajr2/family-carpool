package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CalendarLeaveFromRepository extends JpaRepository<CalendarLeaveFromEntity, UUID> {

    Optional<CalendarLeaveFromEntity> findByAdultIdAndItemSourceAndItemId(
            UUID adultId, LeaveByItemSource itemSource, UUID itemId);
}
