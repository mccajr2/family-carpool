package com.yourorg.quickapp.calendar;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record AssignCalendarCoverageRequest(
        @NotNull UUID coveringAdultId, @NotEmpty List<@NotNull UUID> kidIds) {}
