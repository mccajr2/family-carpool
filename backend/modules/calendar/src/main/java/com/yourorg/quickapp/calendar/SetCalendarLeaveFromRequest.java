package com.yourorg.quickapp.calendar;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SetCalendarLeaveFromRequest(@NotNull UUID leaveFromPlaceId) {}
