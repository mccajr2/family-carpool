package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Persist FORCE_MERGE or FORCE_SPLIT for an ordered adjacent pair (earlier =
 * left, later = right). Viewing adult only — overrides are per adult.
 */
public record SetDriveBlockOverrideRequest(
        @NotNull CarpoolLegKind leg,
        @NotNull CalendarItemSource leftSource,
        @NotNull UUID leftItemId,
        @NotNull CalendarItemSource rightSource,
        @NotNull UUID rightItemId,
        @NotNull DriveBlockOverrideAction action) {}
