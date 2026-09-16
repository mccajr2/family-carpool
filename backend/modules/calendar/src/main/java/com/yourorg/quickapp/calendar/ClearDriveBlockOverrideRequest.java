package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Clear a persisted drive-block override for an ordered pair (restore auto). */
public record ClearDriveBlockOverrideRequest(
        @NotNull CarpoolLegKind leg,
        @NotNull CalendarItemSource leftSource,
        @NotNull UUID leftItemId,
        @NotNull CalendarItemSource rightSource,
        @NotNull UUID rightItemId) {}
