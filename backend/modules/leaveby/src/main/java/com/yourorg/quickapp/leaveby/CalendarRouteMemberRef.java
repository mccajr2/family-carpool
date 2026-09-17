package com.yourorg.quickapp.leaveby;

import java.util.UUID;

/** One calendar item in a driving-block member set (ordered). */
public record CalendarRouteMemberRef(LeaveByItemSource source, UUID itemId) {}
