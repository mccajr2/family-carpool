package com.yourorg.quickapp.leaveby;

import java.time.Instant;
import java.util.UUID;

/** One calendar row for cheap or full leave-by enrichment. */
public record LeaveByItemInput(
        LeaveByItemSource source, UUID itemId, Instant startsAt, String location) {}
