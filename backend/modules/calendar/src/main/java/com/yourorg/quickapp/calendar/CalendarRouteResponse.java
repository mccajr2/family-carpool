package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
import com.yourorg.quickapp.leaveby.CalendarRouteStatus;
import java.util.List;
import java.util.UUID;

/** Multi-stop itinerary for GET …/calendar/{source}/{itemId}/route. */
public record CalendarRouteResponse(
        CalendarRouteStatus status,
        String reason,
        int bufferMinutes,
        List<CalendarRouteStopResponse> stops,
        List<Integer> legMinutes,
        CalendarRouteLeg leg,
        List<CalendarRouteMemberItemResponse> memberItemIds,
        UUID leaveFromPlaceId,
        String leaveFromPlaceName,
        String leaveFromAddress) {

    public CalendarRouteResponse(
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            List<CalendarRouteStopResponse> stops,
            List<Integer> legMinutes) {
        this(status, reason, bufferMinutes, stops, legMinutes, null, List.of(), null, null, null);
    }

    public CalendarRouteResponse(
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            List<CalendarRouteStopResponse> stops,
            List<Integer> legMinutes,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberItemResponse> memberItemIds) {
        this(
                status,
                reason,
                bufferMinutes,
                stops,
                legMinutes,
                leg,
                memberItemIds,
                null,
                null,
                null);
    }
}
