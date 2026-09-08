package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import java.util.List;

/** Multi-stop itinerary for GET …/calendar/{source}/{itemId}/route. */
public record CalendarRouteResponse(
        CalendarRouteStatus status,
        String reason,
        int bufferMinutes,
        List<CalendarRouteStopResponse> stops,
        List<Integer> legMinutes) {}
