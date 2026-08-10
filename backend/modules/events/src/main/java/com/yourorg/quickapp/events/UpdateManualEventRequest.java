package com.yourorg.quickapp.events;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UpdateManualEventRequest(
        @NotBlank @Size(max = 500) String title,
        @NotNull Instant startsAt,
        Instant endsAt,
        @Size(max = 500) String location,
        List<UUID> kidIds) {}
