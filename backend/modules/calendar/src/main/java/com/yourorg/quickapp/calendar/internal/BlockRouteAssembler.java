package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Merges co-located middle stops (ADR-0004 rule 8) before leave-by optimize.
 */
final class BlockRouteAssembler {

    private BlockRouteAssembler() {}

    static List<CalendarRoutePickupInput> mergeColocated(List<CalendarRoutePickupInput> middles) {
        if (middles == null || middles.isEmpty()) {
            return List.of();
        }
        Map<String, CalendarRoutePickupInput> byAddress = new LinkedHashMap<>();
        for (CalendarRoutePickupInput middle : middles) {
            if (middle == null || middle.address() == null || middle.address().isBlank()) {
                continue;
            }
            String key = normalize(middle.address());
            CalendarRoutePickupInput existing = byAddress.get(key);
            if (existing == null) {
                byAddress.put(key, middle);
                continue;
            }
            byAddress.put(key, mergePair(existing, middle));
        }
        return List.copyOf(byAddress.values());
    }

    private static CalendarRoutePickupInput mergePair(
            CalendarRoutePickupInput left, CalendarRoutePickupInput right) {
        String name = joinNames(left.name(), right.name());
        CalendarRouteNotifyContact contact =
                left.contact() != null ? left.contact() : right.contact();
        CalendarRouteStopKind kind =
                left.kind() != null ? left.kind() : CalendarRouteStopKind.PICKUP;
        return new CalendarRoutePickupInput(name, left.address(), contact, kind);
    }

    private static String joinNames(String a, String b) {
        String left = a == null ? "" : a.trim();
        String right = b == null ? "" : b.trim();
        if (left.isEmpty()) {
            return right;
        }
        if (right.isEmpty() || left.equalsIgnoreCase(right)) {
            return left;
        }
        if (left.toLowerCase(Locale.ROOT).contains(right.toLowerCase(Locale.ROOT))) {
            return left;
        }
        if (right.toLowerCase(Locale.ROOT).contains(left.toLowerCase(Locale.ROOT))) {
            return right;
        }
        return left + " and " + right;
    }

    static String normalize(String address) {
        return address == null ? "" : address.trim().toLowerCase(Locale.ROOT);
    }

    /** Drop middles whose address matches the fixed start/end (no duplicate home). */
    static List<CalendarRoutePickupInput> withoutAddress(
            List<CalendarRoutePickupInput> middles, String address) {
        if (middles == null || middles.isEmpty()) {
            return List.of();
        }
        String key = normalize(address);
        if (key.isEmpty()) {
            return List.copyOf(middles);
        }
        List<CalendarRoutePickupInput> out = new ArrayList<>();
        for (CalendarRoutePickupInput middle : middles) {
            if (middle == null || middle.address() == null) {
                continue;
            }
            if (key.equals(normalize(middle.address()))) {
                continue;
            }
            out.add(middle);
        }
        return List.copyOf(out);
    }
}
