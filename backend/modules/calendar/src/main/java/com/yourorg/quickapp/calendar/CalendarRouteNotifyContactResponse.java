package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;

/** Stub notify contact on a pickup stop (local UI only). */
public record CalendarRouteNotifyContactResponse(CalendarRouteNotifyChannel channel, String to) {}
