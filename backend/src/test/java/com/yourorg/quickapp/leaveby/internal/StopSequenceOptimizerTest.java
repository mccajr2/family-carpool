package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.leaveby.internal.StopSequenceOptimizer.DurationLookup;
import com.yourorg.quickapp.leaveby.internal.StopSequenceOptimizer.Waypoint;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class StopSequenceOptimizerTest {

    private static final Waypoint HOME = wp("home", 0, 0);
    private static final Waypoint VENUE = wp("venue", 10, 0);

    @Test
    void choosesShorterPermutationThanInputOrder() {
        // Input order A→B is long; B→A is short (classic crossed pickups).
        Waypoint a = wp("pickup-a", 1, 5);
        Waypoint b = wp("pickup-b", 1, 1);
        DurationLookup durations =
                matrix(
                        edge(HOME, a, 500),
                        edge(HOME, b, 100),
                        edge(a, b, 400),
                        edge(b, a, 400),
                        edge(a, VENUE, 100),
                        edge(b, VENUE, 500));

        Optional<List<Waypoint>> result =
                StopSequenceOptimizer.optimizeMiddles(HOME, List.of(a, b), VENUE, durations);

        assertThat(result).isPresent();
        assertThat(ids(result.get())).containsExactly("pickup-b", "pickup-a");
        assertThat(pathSeconds(HOME, result.get(), VENUE, durations))
                .isLessThan(pathSeconds(HOME, List.of(a, b), VENUE, durations));
    }

    @Test
    void acceptsNorthStarShapedWaypointListWithoutCalendarTypes() {
        // home → community center → school → teammate house → rink (opaque ids only).
        Waypoint community = wp("kid1-community-center", 2, 3);
        Waypoint school = wp("kid2-school", 4, 1);
        Waypoint teammate = wp("teammate-house", 6, 2);
        Waypoint rink = wp("rink", 8, 0);
        DurationLookup durations =
                matrix(
                        edge(HOME, community, 300),
                        edge(HOME, school, 900),
                        edge(HOME, teammate, 1200),
                        edge(community, school, 200),
                        edge(community, teammate, 800),
                        edge(school, community, 200),
                        edge(school, teammate, 250),
                        edge(teammate, community, 800),
                        edge(teammate, school, 250),
                        edge(community, rink, 900),
                        edge(school, rink, 500),
                        edge(teammate, rink, 200));

        // Bad input order: teammate first (far), then school, then community.
        Optional<List<Waypoint>> result =
                StopSequenceOptimizer.optimizeMiddles(
                        HOME, List.of(teammate, school, community), rink, durations);

        assertThat(result).isPresent();
        assertThat(ids(result.get()))
                .containsExactly("kid1-community-center", "kid2-school", "teammate-house");
    }

    @Test
    void returnsEmptyWhenAnyRequiredDurationMissing() {
        Waypoint a = wp("a", 1, 0);
        Waypoint b = wp("b", 2, 0);
        DurationLookup sparse =
                (from, to) -> {
                    if (from.id().equals("home") && to.id().equals("a")) {
                        return Optional.of(100.0);
                    }
                    if (from.id().equals("a") && to.id().equals("venue")) {
                        return Optional.of(100.0);
                    }
                    // Missing home→b, a↔b, b→venue, etc.
                    return Optional.empty();
                };

        assertThat(StopSequenceOptimizer.optimizeMiddles(HOME, List.of(a, b), VENUE, sparse))
                .isEmpty();
    }

    @Test
    void zeroOrOneMiddleKeepsShape() {
        assertThat(StopSequenceOptimizer.optimizeMiddles(HOME, List.of(), VENUE, always(60)))
                .contains(List.of());

        Waypoint only = wp("only", 1, 0);
        DurationLookup one =
                matrix(edge(HOME, only, 120), edge(only, VENUE, 180));
        assertThat(StopSequenceOptimizer.optimizeMiddles(HOME, List.of(only), VENUE, one))
                .contains(List.of(only));
    }

    @Test
    void usesNearestNeighborAboveBruteForceCap() {
        int n = StopSequenceOptimizer.BRUTE_FORCE_MAX_MIDDLES + 1;
        List<Waypoint> middles =
                IntStream.range(0, n).mapToObj(i -> wp("m" + i, i + 1, 0)).toList();

        // Distances: from home, nearest is m0, then each mi → m{i+1} is cheapest;
        // reverse input order so NN must reorder.
        Map<String, Double> edges = new HashMap<>();
        for (int i = 0; i < n; i++) {
            Waypoint mi = middles.get(i);
            edges.put(key(HOME, mi), 100.0 + i * 50.0);
            edges.put(key(mi, VENUE), 1000.0 - i * 10.0);
            for (int j = 0; j < n; j++) {
                if (i == j) {
                    continue;
                }
                Waypoint mj = middles.get(j);
                double leg = (j == i + 1) ? 50.0 : 500.0 + Math.abs(i - j) * 20.0;
                edges.put(key(mi, mj), leg);
            }
        }
        DurationLookup durations =
                (from, to) -> Optional.ofNullable(edges.get(key(from, to)));

        List<Waypoint> reversed = middles.reversed();
        Optional<List<Waypoint>> result =
                StopSequenceOptimizer.optimizeMiddles(HOME, reversed, VENUE, durations);

        assertThat(result).isPresent();
        assertThat(ids(result.get())).containsExactlyElementsOf(ids(middles));
    }

    private static Waypoint wp(String id, double lat, double lng) {
        return new Waypoint(id, lat, lng);
    }

    private static List<String> ids(List<Waypoint> waypoints) {
        return waypoints.stream().map(Waypoint::id).toList();
    }

    private static double pathSeconds(
            Waypoint start, List<Waypoint> middles, Waypoint end, DurationLookup durations) {
        double total = 0;
        Waypoint prev = start;
        for (Waypoint middle : middles) {
            total += durations.secondsBetween(prev, middle).orElseThrow();
            prev = middle;
        }
        total += durations.secondsBetween(prev, end).orElseThrow();
        return total;
    }

    private record Edge(String key, double seconds) {}

    private static Edge edge(Waypoint from, Waypoint to, double seconds) {
        return new Edge(key(from, to), seconds);
    }

    private static String key(Waypoint from, Waypoint to) {
        return from.id() + "->" + to.id();
    }

    private static DurationLookup matrix(Edge... edges) {
        Map<String, Double> map =
                java.util.Arrays.stream(edges)
                        .collect(Collectors.toMap(Edge::key, Edge::seconds));
        return (from, to) -> Optional.ofNullable(map.get(key(from, to)));
    }

    private static DurationLookup always(double seconds) {
        return (from, to) -> Optional.of(seconds);
    }
}
