package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.family.FamilyGarageApi;
import com.yourorg.quickapp.family.GarageResponse;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
class FamilyGarageApiImpl implements FamilyGarageApi {

    private final GarageService garageService;

    FamilyGarageApiImpl(GarageService garageService) {
        this.garageService = garageService;
    }

    @Override
    public GarageResponse garageForCircle(UUID circleId) {
        return garageService.snapshotForCircle(circleId);
    }
}
