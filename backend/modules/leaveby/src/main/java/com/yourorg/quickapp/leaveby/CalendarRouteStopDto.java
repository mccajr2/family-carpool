package com.yourorg.quickapp.leaveby;

/** One ordered stop in a multi-stop itinerary. */
public record CalendarRouteStopDto(
        String name,
        String address,
        CalendarRouteStopKind kind,
        CalendarRouteNotifyContact contact) {}
