package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.family.GeoPointDto;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

/**
 * Drops middle stops that match the governing HOME place for a leg (ADR-0004
 * rule 8 applied to origin/end + middle). Compare by located placeId (when the
 * middle address matches that place), then normalized address, then rounded
 * geocode.
 */
final class HomeSideFlatten {

    private HomeSideFlatten() {}

    static List<CalendarRoutePickupInput> withoutMatchingHome(
            List<CalendarRoutePickupInput> middles,
            UUID homePlaceId,
            String homeAddress,
            Double homeLat,
            Double homeLng,
            Function<String, Optional<GeoPointDto>> geocode) {
        if (middles == null || middles.isEmpty()) {
            return List.of();
        }
        String homeKey = normalize(homeAddress);
        List<CalendarRoutePickupInput> out = new ArrayList<>(middles.size());
        for (CalendarRoutePickupInput middle : middles) {
            if (middle == null || middle.address() == null || middle.address().isBlank()) {
                continue;
            }
            if (homePlaceId != null
                    && samePlaceId(
                            homePlaceId, middlePlaceIdHint(middle, homeAddress, homePlaceId))) {
                continue;
            }
            if (matchesHome(middle.address(), homeKey, homeLat, homeLng, geocode)) {
                continue;
            }
            out.add(middle);
        }
        return List.copyOf(out);
    }

    /**
     * Middles do not carry placeId today; when the middle address matches the
     * home address of a named place, treat as the same located placeId.
     */
    private static UUID middlePlaceIdHint(
            CalendarRoutePickupInput middle, String homeAddress, UUID homePlaceId) {
        if (homePlaceId == null) {
            return null;
        }
        if (normalize(middle.address()).equals(normalize(homeAddress))) {
            return homePlaceId;
        }
        return null;
    }

    static boolean matchesHome(
            String middleAddress,
            String normalizedHomeAddress,
            Double homeLat,
            Double homeLng,
            Function<String, Optional<GeoPointDto>> geocode) {
        String middleKey = normalize(middleAddress);
        if (!middleKey.isEmpty()
                && !normalizedHomeAddress.isEmpty()
                && middleKey.equals(normalizedHomeAddress)) {
            return true;
        }
        if (homeLat == null || homeLng == null || geocode == null) {
            return false;
        }
        Optional<GeoPointDto> point = geocode.apply(middleAddress);
        if (point.isEmpty()) {
            return false;
        }
        return sameCoord(homeLat, point.get().latitude())
                && sameCoord(homeLng, point.get().longitude());
    }

    static boolean samePlaceId(UUID homePlaceId, UUID middlePlaceId) {
        return homePlaceId != null && homePlaceId.equals(middlePlaceId);
    }

    static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean sameCoord(double a, double b) {
        return formatCoord(a).equals(formatCoord(b));
    }

    private static String formatCoord(double value) {
        return String.format(Locale.ROOT, "%.6f", value);
    }
}
