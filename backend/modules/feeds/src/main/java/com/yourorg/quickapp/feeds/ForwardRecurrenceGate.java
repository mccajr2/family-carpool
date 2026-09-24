package com.yourorg.quickapp.feeds;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Forward recurrence gate for Lock CTA eligibility: every FEED member of the
 * current drive block must have ≥{@link #MIN_OTHER_MATCHES} other upcoming FEED
 * rows in the synced horizon that share that member's
 * {@link RecurringFeedFingerprint} (excluding the member itself).
 */
public final class ForwardRecurrenceGate {

    /** Other upcoming fingerprint matches required beyond the block member. */
    public static final int MIN_OTHER_MATCHES = 3;

    private ForwardRecurrenceGate() {}

    /**
     * @param blockFeedMembers FEED members of the viewing adult's current drive
     *     block (MANUAL members omitted by the caller)
     * @param horizonFeedEvents synced FEED events available to scan; may include
     *     rows outside the horizon — those are ignored
     * @param zone same zone Agenda uses for local day grouping
     * @param horizonStartInclusive typically local-today start as Instant
     * @param horizonEndExclusive exclusive end of the loaded/synced window
     */
    public static boolean isLockEligible(
            List<FeedCalendarEventDto> blockFeedMembers,
            List<FeedCalendarEventDto> horizonFeedEvents,
            ZoneId zone,
            Instant horizonStartInclusive,
            Instant horizonEndExclusive) {
        Objects.requireNonNull(zone, "zone");
        Objects.requireNonNull(horizonStartInclusive, "horizonStartInclusive");
        Objects.requireNonNull(horizonEndExclusive, "horizonEndExclusive");
        if (blockFeedMembers == null || blockFeedMembers.isEmpty()) {
            return false;
        }
        if (!horizonStartInclusive.isBefore(horizonEndExclusive)) {
            return false;
        }
        List<FeedCalendarEventDto> horizon =
                horizonFeedEvents == null ? List.of() : horizonFeedEvents;
        for (FeedCalendarEventDto member : blockFeedMembers) {
            if (member == null) {
                return false;
            }
            if (countOtherMatches(
                            member, horizon, zone, horizonStartInclusive, horizonEndExclusive)
                    < MIN_OTHER_MATCHES) {
                return false;
            }
        }
        return true;
    }

    /**
     * Counts other FEED rows in {@code [horizonStart, horizonEnd)} that share
     * {@code member}'s fingerprint, excluding {@code member} by event id.
     */
    public static int countOtherMatches(
            FeedCalendarEventDto member,
            List<FeedCalendarEventDto> horizonFeedEvents,
            ZoneId zone,
            Instant horizonStartInclusive,
            Instant horizonEndExclusive) {
        Objects.requireNonNull(member, "member");
        Objects.requireNonNull(zone, "zone");
        Objects.requireNonNull(horizonStartInclusive, "horizonStartInclusive");
        Objects.requireNonNull(horizonEndExclusive, "horizonEndExclusive");
        RecurringFeedFingerprint target = RecurringFeedFingerprint.of(member, zone);
        UUID memberId = member.id();
        int count = 0;
        if (horizonFeedEvents == null) {
            return 0;
        }
        for (FeedCalendarEventDto event : horizonFeedEvents) {
            if (event == null || event.id().equals(memberId)) {
                continue;
            }
            Instant startsAt = event.startsAt();
            if (startsAt == null
                    || startsAt.isBefore(horizonStartInclusive)
                    || !startsAt.isBefore(horizonEndExclusive)) {
                continue;
            }
            if (RecurringFeedFingerprint.of(event, zone).equals(target)) {
                count++;
            }
        }
        return count;
    }
}
