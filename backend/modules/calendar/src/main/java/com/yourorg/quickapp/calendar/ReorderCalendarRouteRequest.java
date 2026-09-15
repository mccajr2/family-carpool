package com.yourorg.quickapp.calendar;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Manual middle-stop reorder for PUT …/calendar/{source}/{itemId}/route.
 * Identities are pickup stop addresses as returned on the route.
 */
public record ReorderCalendarRouteRequest(@NotNull List<String> middleStopIds) {}
