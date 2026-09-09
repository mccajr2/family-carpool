package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record AcceptCarpoolRequestRequest(
        @NotNull UUID vehicleId, List<@NotNull UUID> passengerRequestIds) {}
