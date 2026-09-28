package com.yourorg.quickapp.carpool.internal;

import com.yourorg.quickapp.carpool.StandingRideArrangementDto;
import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.feeds.FeedEventKey;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Materialises ACCEPTED ride snapshots onto blank fingerprint matches for
 * {@code ACTIVE} standing arrangements. Soft-fails per occurrence (and as a
 * whole after Accept) so failures never roll back Accept or poison enrich.
 */
@Service
public class StandingRideMaterialiseService {

    /** Same feed-backed horizon length as household Lock apply / standing create gate. */
    public static final int KNOWN_SCHEDULE_DAYS = 400;

    private final StandingRideArrangementService arrangements;
    private final CarpoolRideService rideService;
    private final FeedCalendarApi feedCalendarApi;
    private final CarpoolMembershipRepository memberships;

    public StandingRideMaterialiseService(
            StandingRideArrangementService arrangements,
            CarpoolRideService rideService,
            FeedCalendarApi feedCalendarApi,
            CarpoolMembershipRepository memberships) {
        this.arrangements = arrangements;
        this.rideService = rideService;
        this.feedCalendarApi = feedCalendarApi;
        this.memberships = memberships;
    }

    /**
     * Upper bound for the known schedule: at least {@code from + KNOWN_SCHEDULE_DAYS},
     * never clipped to a short Agenda page {@code requestTo}.
     */
    public static Instant knownScheduleTo(Instant from, Instant requestTo) {
        Objects.requireNonNull(from, "from");
        Instant knownTo = from.plus(Duration.ofDays(KNOWN_SCHEDULE_DAYS));
        if (requestTo != null && requestTo.isAfter(knownTo)) {
            return requestTo;
        }
        return knownTo;
    }

    static Instant knownScheduleFrom(Instant requestFrom, Instant now) {
        Objects.requireNonNull(requestFrom, "requestFrom");
        Objects.requireNonNull(now, "now");
        if (requestFrom.isAfter(now)) {
            return now;
        }
        return requestFrom;
    }

    /** Materialise one ACTIVE arrangement over the feed-backed known schedule. */
    @Transactional
    public int materialiseArrangement(UUID spaceId, UUID arrangementId) {
        Objects.requireNonNull(spaceId, "spaceId");
        Objects.requireNonNull(arrangementId, "arrangementId");
        StandingRideArrangementDto arrangement =
                arrangements.findBySpaceAndId(spaceId, arrangementId).orElse(null);
        if (arrangement == null || arrangement.status() != StandingRideArrangementStatus.ACTIVE) {
            return 0;
        }
        Instant now = Instant.now();
        Instant knownFrom = knownScheduleFrom(now, now);
        Instant knownTo = knownScheduleTo(knownFrom, null);
        return materialise(arrangement, knownFrom, knownTo);
    }

    /**
     * Calendar/sync enrich: materialise every ACTIVE arrangement in spaces this
     * circle belongs to, over the feed-backed known schedule.
     */
    @Transactional
    public int materialiseForCircle(UUID circleId, Instant horizonFrom, Instant horizonTo) {
        Objects.requireNonNull(circleId, "circleId");
        Objects.requireNonNull(horizonFrom, "horizonFrom");
        Objects.requireNonNull(horizonTo, "horizonTo");
        Instant knownFrom = knownScheduleFrom(horizonFrom, Instant.now());
        Instant knownTo = knownScheduleTo(knownFrom, horizonTo);
        if (!knownFrom.isBefore(knownTo)) {
            return 0;
        }
        int total = 0;
        for (CarpoolMembershipEntity membership :
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId)) {
            for (StandingRideArrangementDto arrangement :
                    arrangements.listActiveForSpace(membership.spaceId())) {
                total += materialise(arrangement, knownFrom, knownTo);
            }
        }
        return total;
    }

    private int materialise(
            StandingRideArrangementDto arrangement, Instant knownFrom, Instant knownTo) {
        ZoneId zone = ZoneId.of(arrangement.timeZone());
        List<FeedCalendarEventDto> horizon =
                feedCalendarApi.listEventsInRange(
                        arrangement.requestingCircleId(), knownFrom, knownTo);
        RecurringFeedFingerprint fingerprint = arrangement.fingerprint();
        int created = 0;
        for (FeedCalendarEventDto event : horizon) {
            if (event.startsAt().isBefore(knownFrom) || !event.startsAt().isBefore(knownTo)) {
                continue;
            }
            if (!fingerprint.equals(RecurringFeedFingerprint.of(event, zone))) {
                continue;
            }
            if (rideService.tryMaterialiseStandingOccurrence(arrangement, FeedEventKey.of(event))) {
                created++;
            }
        }
        return created;
    }
}
