package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import java.util.List;
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

    @Override
    public void clearTransportForNotGoingKid(
            UUID actorAdultId, UUID feedEventId, UUID kidId) {
        rideService.clearTransportForNotGoingKid(actorAdultId, feedEventId, kidId);
    }

    @Override
    public List<CarpoolAcceptedPickupDto> listAcceptedPickupsForFeedEvent(
            UUID circleId, UUID feedEventId) {
        return rideService.listAcceptedPickupsForFeedEvent(circleId, feedEventId);
    }
}
