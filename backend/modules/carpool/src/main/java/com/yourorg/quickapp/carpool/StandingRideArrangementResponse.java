package com.yourorg.quickapp.carpool;

import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.Instant;
import java.util.UUID;

/** Space-member view of a standing ride arrangement (includes Pass chrome). */
public record StandingRideArrangementResponse(
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
        Instant endedAt,
        boolean passedByMe) {

    public static StandingRideArrangementResponse from(
            StandingRideArrangementDto dto, boolean passedByMe) {
        return new StandingRideArrangementResponse(
                dto.id(),
                dto.spaceId(),
                dto.requestingCircleId(),
                dto.requestedByAdultId(),
                dto.fingerprint(),
                dto.timeZone(),
                dto.anchorStartsAt(),
                dto.assignment(),
                dto.status(),
                dto.primaryAdultId(),
                dto.primaryCircleId(),
                dto.askTemplate(),
                dto.createdAt(),
                dto.endedAt(),
                passedByMe);
    }
}
