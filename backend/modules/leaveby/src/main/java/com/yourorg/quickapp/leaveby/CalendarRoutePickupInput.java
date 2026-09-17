package com.yourorg.quickapp.leaveby;

/**
 * Middle stop supplied by calendar/carpool orchestration (snapshot address).
 * Optional contact is a UI stub only. Kind is {@link CalendarRouteStopKind#PICKUP}
 * on TO legs and {@link CalendarRouteStopKind#DROPOFF} on FROM legs.
 */
public record CalendarRoutePickupInput(
        String name,
        String address,
        CalendarRouteNotifyContact contact,
        CalendarRouteStopKind kind) {

    public CalendarRoutePickupInput(String name, String address, CalendarRouteNotifyContact contact) {
        this(name, address, contact, CalendarRouteStopKind.PICKUP);
    }

    public CalendarRoutePickupInput(String name, String address) {
        this(name, address, null, CalendarRouteStopKind.PICKUP);
    }

    public CalendarRoutePickupInput {
        if (kind != CalendarRouteStopKind.PICKUP && kind != CalendarRouteStopKind.DROPOFF) {
            throw new IllegalArgumentException("middle stop kind must be pickup or dropoff");
        }
    }
}
