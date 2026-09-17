package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.CarpoolAcceptedPickupDto;
import com.yourorg.quickapp.carpool.CarpoolApi;
import com.yourorg.quickapp.carpool.CarpoolConfirmedDrivingLegDto;
import com.yourorg.quickapp.carpool.CarpoolHouseholdStopDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.util.Collection;
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
    public List<CarpoolAcceptedPickupDto> listAcceptedFamilyStopsForFeedEvent(
            UUID circleId, UUID feedEventId, CarpoolLegKind leg) {
        return rideService.listAcceptedFamilyStopsForFeedEvent(circleId, feedEventId, leg);
    }

    @Override
    public List<CarpoolConfirmedDrivingLegDto> listConfirmedDrivingLegs(
            UUID adultId, UUID circleId, Collection<UUID> feedEventIds) {
        return rideService.listConfirmedDrivingLegs(adultId, circleId, feedEventIds);
    }

    @Override
    public List<CarpoolHouseholdStopDto> listConfirmedHouseholdStopsForFeedEvent(
            UUID adultId, UUID circleId, UUID feedEventId, CarpoolLegKind leg) {
        return rideService.listConfirmedHouseholdStopsForFeedEvent(
                adultId, circleId, feedEventId, leg);
    }
}
