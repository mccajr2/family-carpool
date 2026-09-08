package com.yourorg.quickapp.leaveby.internal;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.yourorg.quickapp.family.DrivingOriginChangedEvent;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DrivingOriginChangedListenerTest {

    @Mock
    private LeaveByApi leaveByApi;

    @InjectMocks
    private DrivingOriginChangedListener listener;

    @Test
    void invalidatesItinerariesForDrivingAdult() {
        UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000001");
        listener.onDrivingOriginChanged(new DrivingOriginChangedEvent(adultId));
        verify(leaveByApi).invalidateCalendarRoutesForDrivingAdult(adultId);
    }

    @Test
    void ignoresNullAdultId() {
        listener.onDrivingOriginChanged(new DrivingOriginChangedEvent(null));
        verify(leaveByApi, never()).invalidateCalendarRoutesForDrivingAdult(null);
    }
}
