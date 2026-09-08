package com.yourorg.quickapp.leaveby;

import java.util.List;

/**
 * Multi-stop driving itinerary for a confirmed ride. Always an estimate — never
 * live traffic. When {@link CalendarRouteStatus#UNAVAILABLE}, {@code legMinutes}
 * is empty and clients must not present fixture leave-by as live.
 */
public record CalendarRouteDto(
        CalendarRouteStatus status,
        String reason,
        int bufferMinutes,
        List<CalendarRouteStopDto> stops,
        List<Integer> legMinutes) {

    public static CalendarRouteDto unavailable(
            String reason, int bufferMinutes, List<CalendarRouteStopDto> stops) {
        return new CalendarRouteDto(
                CalendarRouteStatus.UNAVAILABLE,
                reason,
                bufferMinutes,
                List.copyOf(stops),
                List.of());
    }

    public static CalendarRouteDto ok(
            int bufferMinutes, List<CalendarRouteStopDto> stops, List<Integer> legMinutes) {
        return new CalendarRouteDto(
                CalendarRouteStatus.OK, null, bufferMinutes, List.copyOf(stops), List.copyOf(legMinutes));
    }
}
