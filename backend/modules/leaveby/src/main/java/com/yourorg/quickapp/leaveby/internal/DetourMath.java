package com.yourorg.quickapp.leaveby.internal;

import java.util.Optional;

/** Pure detour delta from routed driving legs (no TOD multiplier or buffer). */
final class DetourMath {

    private DetourMath() {}

    static Integer detourMinutes(
            Optional<Double> directSeconds,
            Optional<Double> originToPickupSeconds,
            Optional<Double> pickupToEventSeconds) {
        if (directSeconds.isEmpty()
                || originToPickupSeconds.isEmpty()
                || pickupToEventSeconds.isEmpty()) {
            return null;
        }
        double viaPickupSeconds = originToPickupSeconds.get() + pickupToEventSeconds.get();
        double deltaSeconds = viaPickupSeconds - directSeconds.get();
        return Math.max(0, (int) Math.round(deltaSeconds / 60.0));
    }
}
