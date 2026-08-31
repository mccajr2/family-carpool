package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolApi;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class CarpoolApiImpl implements CarpoolApi {

    private final CarpoolRideService rideService;

    CarpoolApiImpl(CarpoolRideService rideService) {
        this.rideService = rideService;
    }

    @Override
    public void withdrawAcceptedInboundForFeedEvent(UUID actorAdultId, UUID feedEventId) {
        rideService.withdrawAcceptedInboundForFeedEvent(actorAdultId, feedEventId);
    }
}
