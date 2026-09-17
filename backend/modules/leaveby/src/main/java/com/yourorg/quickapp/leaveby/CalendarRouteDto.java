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
        List<Integer> legMinutes,
        CalendarRouteLeg leg,
        List<CalendarRouteMemberRef> memberItemIds) {

    public CalendarRouteDto(
            CalendarRouteStatus status,
            String reason,
            int bufferMinutes,
            List<CalendarRouteStopDto> stops,
            List<Integer> legMinutes) {
        this(status, reason, bufferMinutes, stops, legMinutes, CalendarRouteLeg.TO, List.of());
    }

    public static CalendarRouteDto unavailable(
            String reason, int bufferMinutes, List<CalendarRouteStopDto> stops) {
        return unavailable(reason, bufferMinutes, stops, CalendarRouteLeg.TO, List.of());
    }

    public static CalendarRouteDto unavailable(
            String reason,
            int bufferMinutes,
            List<CalendarRouteStopDto> stops,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItemIds) {
        return new CalendarRouteDto(
                CalendarRouteStatus.UNAVAILABLE,
                reason,
                bufferMinutes,
                List.copyOf(stops),
                List.of(),
                leg == null ? CalendarRouteLeg.TO : leg,
                memberItemIds == null ? List.of() : List.copyOf(memberItemIds));
    }

    public static CalendarRouteDto ok(
            int bufferMinutes, List<CalendarRouteStopDto> stops, List<Integer> legMinutes) {
        return ok(bufferMinutes, stops, legMinutes, CalendarRouteLeg.TO, List.of());
    }

    public static CalendarRouteDto ok(
            int bufferMinutes,
            List<CalendarRouteStopDto> stops,
            List<Integer> legMinutes,
            CalendarRouteLeg leg,
            List<CalendarRouteMemberRef> memberItemIds) {
        return new CalendarRouteDto(
                CalendarRouteStatus.OK,
                null,
                bufferMinutes,
                List.copyOf(stops),
                List.copyOf(legMinutes),
                leg == null ? CalendarRouteLeg.TO : leg,
                memberItemIds == null ? List.of() : List.copyOf(memberItemIds));
    }
}
