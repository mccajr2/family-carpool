package com.yourorg.quickapp.family;

import java.util.List;
import java.util.UUID;

public record CreateVehicleRequest(
        String label,
        Integer year,
        String make,
        String model,
        Integer seats,
        List<UUID> driverAdultIds,
        UUID keptAtPlaceId) {}
