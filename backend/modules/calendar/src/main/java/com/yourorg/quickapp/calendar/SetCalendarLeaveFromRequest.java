package com.yourorg.quickapp.calendar;

import java.util.UUID;

/**
 * Set leave-from to a named place, a one-time address, or clear to Default
 * (both null). Place and address are mutually exclusive.
 */
public record SetCalendarLeaveFromRequest(UUID leaveFromPlaceId, String leaveFromAddress) {}
