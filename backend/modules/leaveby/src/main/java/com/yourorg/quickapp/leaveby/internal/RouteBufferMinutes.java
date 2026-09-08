package com.yourorg.quickapp.leaveby.internal;

import java.util.regex.Pattern;

/**
 * Locked arrival buffer for multi-stop Route itineraries until editable lead
 * times land. Practice wins over game when both match.
 */
final class RouteBufferMinutes {

    private static final Pattern PRACTICE =
            Pattern.compile("\\bpractice\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern GAME =
            Pattern.compile("\\b(game|match|vs\\.?|versus)\\b", Pattern.CASE_INSENSITIVE);

    private RouteBufferMinutes() {}

    static int forTitle(String title) {
        String normalized = title == null ? "" : title.trim();
        if (PRACTICE.matcher(normalized).find()) {
            return 20;
        }
        if (GAME.matcher(normalized).find()) {
            return 45;
        }
        return 0;
    }
}
