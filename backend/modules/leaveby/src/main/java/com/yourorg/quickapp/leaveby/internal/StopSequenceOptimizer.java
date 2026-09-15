package com.yourorg.quickapp.leaveby.internal;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Pure stop-sequence optimizer: fixed start + reorderable middle waypoints + fixed end.
 * Minimizes total pairwise driving duration. No calendar / RideRequest types.
 *
 * <p>Missing any required pairwise duration → empty (caller soft-fails; no invented
 * fixture minutes). Brute-force when middle count ≤ {@link #BRUTE_FORCE_MAX_MIDDLES};
 * nearest-neighbor heuristic above that cap.
 */
final class StopSequenceOptimizer {

    /** Inclusive middle-stop count that still uses exhaustive permutation search. */
    static final int BRUTE_FORCE_MAX_MIDDLES = 7;

    private StopSequenceOptimizer() {}

    /** Opaque middle (or anchor) stop: identity + geocoded coords. */
    record Waypoint(String id, double latitude, double longitude) {
        Waypoint {
            Objects.requireNonNull(id, "id");
        }
    }

    /** Pairwise driving duration in seconds; empty means unavailable. */
    @FunctionalInterface
    interface DurationLookup {
        Optional<Double> secondsBetween(Waypoint from, Waypoint to);
    }

    /**
     * Returns the middle waypoints in an order that minimizes start → middles → end
     * total duration, or empty if any required pairwise duration is missing.
     */
    static Optional<List<Waypoint>> optimizeMiddles(
            Waypoint start, List<Waypoint> middles, Waypoint end, DurationLookup durations) {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(end, "end");
        Objects.requireNonNull(durations, "durations");
        List<Waypoint> middleList = middles == null ? List.of() : List.copyOf(middles);
        if (middleList.isEmpty()) {
            return Optional.of(List.of());
        }
        if (middleList.size() == 1) {
            Waypoint only = middleList.get(0);
            if (durations.secondsBetween(start, only).isEmpty()
                    || durations.secondsBetween(only, end).isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(List.of(only));
        }

        Optional<Map<String, Double>> matrix = buildRequiredMatrix(start, middleList, end, durations);
        if (matrix.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Double> seconds = matrix.get();

        if (middleList.size() <= BRUTE_FORCE_MAX_MIDDLES) {
            return Optional.of(bruteForceBest(start, middleList, end, seconds));
        }
        return Optional.of(nearestNeighbor(start, middleList, seconds));
    }

    private static Optional<Map<String, Double>> buildRequiredMatrix(
            Waypoint start, List<Waypoint> middles, Waypoint end, DurationLookup durations) {
        Map<String, Double> matrix = new HashMap<>();
        for (Waypoint middle : middles) {
            Optional<Double> fromStart = durations.secondsBetween(start, middle);
            Optional<Double> toEnd = durations.secondsBetween(middle, end);
            if (fromStart.isEmpty() || toEnd.isEmpty()) {
                return Optional.empty();
            }
            matrix.put(edgeKey(start, middle), fromStart.get());
            matrix.put(edgeKey(middle, end), toEnd.get());
        }
        for (Waypoint from : middles) {
            for (Waypoint to : middles) {
                if (from.id().equals(to.id())) {
                    continue;
                }
                Optional<Double> leg = durations.secondsBetween(from, to);
                if (leg.isEmpty()) {
                    return Optional.empty();
                }
                matrix.put(edgeKey(from, to), leg.get());
            }
        }
        return Optional.of(matrix);
    }

    private static List<Waypoint> bruteForceBest(
            Waypoint start, List<Waypoint> middles, Waypoint end, Map<String, Double> seconds) {
        Best best = new Best(List.copyOf(middles), pathCost(start, middles, end, seconds));
        List<Waypoint> working = new ArrayList<>(middles);
        permuteAndScore(working, working.size(), start, end, seconds, best);
        return best.order;
    }

    /** Mutable best-so-far for Heap's algorithm permutation scoring. */
    private static final class Best {
        List<Waypoint> order;
        double cost;

        Best(List<Waypoint> order, double cost) {
            this.order = order;
            this.cost = cost;
        }
    }

    private static void permuteAndScore(
            List<Waypoint> working,
            int n,
            Waypoint start,
            Waypoint end,
            Map<String, Double> seconds,
            Best best) {
        if (n == 1) {
            double cost = pathCost(start, working, end, seconds);
            if (cost < best.cost) {
                best.cost = cost;
                best.order = List.copyOf(working);
            }
            return;
        }
        for (int i = 0; i < n; i++) {
            permuteAndScore(working, n - 1, start, end, seconds, best);
            int j = (n % 2 == 0) ? i : 0;
            Collections.swap(working, j, n - 1);
        }
    }

    private static List<Waypoint> nearestNeighbor(
            Waypoint start, List<Waypoint> middles, Map<String, Double> seconds) {
        List<Waypoint> remaining = new ArrayList<>(middles);
        List<Waypoint> order = new ArrayList<>(middles.size());
        Waypoint current = start;
        while (!remaining.isEmpty()) {
            int bestIndex = 0;
            double bestLeg = seconds.get(edgeKey(current, remaining.get(0)));
            for (int i = 1; i < remaining.size(); i++) {
                double leg = seconds.get(edgeKey(current, remaining.get(i)));
                if (leg < bestLeg) {
                    bestLeg = leg;
                    bestIndex = i;
                }
            }
            Waypoint next = remaining.remove(bestIndex);
            order.add(next);
            current = next;
        }
        return List.copyOf(order);
    }

    private static double pathCost(
            Waypoint start, List<Waypoint> middles, Waypoint end, Map<String, Double> seconds) {
        double total = 0;
        Waypoint previous = start;
        for (Waypoint middle : middles) {
            total += seconds.get(edgeKey(previous, middle));
            previous = middle;
        }
        total += seconds.get(edgeKey(previous, end));
        return total;
    }

    private static String edgeKey(Waypoint from, Waypoint to) {
        return from.id() + "->" + to.id();
    }
}
