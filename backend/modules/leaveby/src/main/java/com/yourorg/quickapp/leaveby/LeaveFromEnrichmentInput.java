package com.yourorg.quickapp.leaveby;

import java.time.Instant;
import java.util.UUID;

/** One coverage-style leave-from enrichment input (shares caches in a batch). */
public record LeaveFromEnrichmentInput(
        UUID adultIdForDefault,
        UUID leaveFromPlaceId,
        String leaveFromAddress,
        Instant startsAt,
        String location) {}
