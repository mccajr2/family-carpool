package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.time.Instant;
import java.util.UUID;

/** One persisted driving-block pair override for a viewing adult. */
public record DriveBlockOverrideDto(
        UUID id,
        UUID adultId,
        CarpoolLegKind leg,
        CalendarItemSource leftItemSource,
        UUID leftItemId,
        CalendarItemSource rightItemSource,
        UUID rightItemId,
        DriveBlockOverrideAction action,
        Instant createdAt) {}
