package com.yourorg.quickapp.leaveby;

/**
 * Pickup stop supplied by carpool/coverage orchestration (snapshot address).
 * Optional contact is a UI stub only.
 */
public record CalendarRoutePickupInput(
        String name, String address, CalendarRouteNotifyContact contact) {

    public CalendarRoutePickupInput(String name, String address) {
        this(name, address, null);
    }
}
