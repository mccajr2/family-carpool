package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import java.util.List;

/** Multi-stop itinerary for GET …/calendar/{source}/{itemId}/route. */
public record CalendarRouteResponse(
        CalendarRouteStatus status,
        String reason,
        int bufferMinutes,
        List<CalendarRouteStopResponse> stops,
        List<Integer> legMinutes,
        CalendarRouteLeg leg,
        List<CalendarRouteMemberItemResponse> memberItemIds) {

    public CalendarRouteResponse(
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            List<CalendarRouteStopResponse> stops,
            List<Integer> legMinutes) {
        this(status, reason, bufferMinutes, stops, legMinutes, null, List.of());
    }
}
