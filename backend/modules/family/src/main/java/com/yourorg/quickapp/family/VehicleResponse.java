package com.yourorg.quickapp.family;

import java.util.List;
import java.util.UUID;

public record VehicleResponse(
        UUID id,
        UUID ownerAdultId,
        List<UUID> driverAdultIds,
        UUID keptAtPlaceId,
        String label,
        int year,
        String make,
        String model,
        int seats,
        Integer suggestedSeats) {}
