package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.util.List;

/** One FEED member of a locked block, with household state snapshot. */
public record StandingBlockMemberSnapshotDto(
        RecurringFeedFingerprint fingerprint,
        int position,
        List<StandingCoverageSnapshotDto> coverages,
        List<StandingRidePlanSnapshotDto> ridePlans,
        List<StandingRouteOriginSnapshotDto> routeOrigins) {}
