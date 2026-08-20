package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AcceptCarpoolRideRequest(@NotNull UUID vehicleId) {}
