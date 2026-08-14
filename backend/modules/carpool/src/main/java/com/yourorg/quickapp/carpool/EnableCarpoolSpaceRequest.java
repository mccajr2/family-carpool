package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record EnableCarpoolSpaceRequest(@NotNull UUID feedId) {}
