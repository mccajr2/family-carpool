package com.yourorg.quickapp.carpool;

import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.Instant;
import java.util.UUID;

/** Persisted standing ride arrangement (series Ask / fixed primary). */
public record StandingRideArrangementDto(
        UUID id,
        UUID spaceId,
        UUID requestingCircleId,
        UUID requestedByAdultId,
        RecurringFeedFingerprint fingerprint,
        String timeZone,
        Instant anchorStartsAt,
        StandingRideAssignment assignment,
        StandingRideArrangementStatus status,
        UUID primaryAdultId,
        UUID primaryCircleId,
        StandingRideAskTemplateDto askTemplate,
        Instant createdAt,
        Instant endedAt) {}
