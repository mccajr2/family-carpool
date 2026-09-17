package com.yourorg.quickapp.calendar;

import java.util.UUID;

/** One member of a driving-block route member-set (OpenAPI CalendarRouteMemberItem). */
public record CalendarRouteMemberItemResponse(CalendarItemSource source, UUID itemId) {}
