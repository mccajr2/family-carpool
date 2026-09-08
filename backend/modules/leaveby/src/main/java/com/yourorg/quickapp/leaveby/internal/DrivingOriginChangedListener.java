package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.family.DrivingOriginChangedEvent;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Invalidates multi-stop itineraries when a driving adult's leave-from origin changes. */
@Component
class DrivingOriginChangedListener {

    private final LeaveByApi leaveByApi;

    DrivingOriginChangedListener(LeaveByApi leaveByApi) {
        this.leaveByApi = leaveByApi;
    }

    @EventListener
    @Transactional
    void onDrivingOriginChanged(DrivingOriginChangedEvent event) {
        if (event == null || event.adultId() == null) {
            return;
        }
        leaveByApi.invalidateCalendarRoutesForDrivingAdult(event.adultId());
    }
}
