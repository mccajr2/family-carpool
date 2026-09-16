package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.time.Instant;
import java.util.UUID;

/**
 * Adjacent confirmed-driving sibling for the interim Agenda merge/split link.
 * Present only when the viewing adult is the confirmed driver on {@code leg}
 * and another confirmed-driving item is time-adjacent on that leg.
 */
public record CalendarDriveBlockLinkResponse(
        CarpoolLegKind leg,
        CalendarItemSource otherSource,
        UUID otherId,
        /** Sibling event title for Agenda copy (avoids ambiguous leave-by clocks). */
        String otherTitle,
        Instant otherStartsAt,
        /** True when this item and {@code otherId} share a computed driving block. */
        boolean combined,
        /**
         * Active pair override, if any. Null means the auto merge rule produced
         * {@code combined}.
         */
        DriveBlockOverrideAction overrideAction) {}
