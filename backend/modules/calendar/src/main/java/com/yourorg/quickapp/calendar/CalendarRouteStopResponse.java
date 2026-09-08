package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;

/** One stop in {@link CalendarRouteResponse}. */
public record CalendarRouteStopResponse(
        String name,
        String address,
        CalendarRouteStopKind kind,
        CalendarRouteNotifyContactResponse contact) {}
