package com.yourorg.quickapp.calendar;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record LockStandingBlockRequest(
        @NotEmpty List<@NotNull UUID> memberItemIds,
        @NotBlank String timeZone,
        @NotNull Instant horizonFrom,
        @NotNull Instant horizonTo) {}
