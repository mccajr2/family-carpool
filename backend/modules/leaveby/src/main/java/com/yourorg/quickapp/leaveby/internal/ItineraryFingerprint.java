package com.yourorg.quickapp.leaveby.internal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Stop fingerprint for itinerary cache validity: normalized addresses plus
 * origin place identity / rounded coords so leave-from or place updates bust
 * the cache.
 */
final class ItineraryFingerprint {

    private ItineraryFingerprint() {}

    static String compute(
            UUID homePlaceId,
            double homeLat,
            double homeLng,
            String homeAddress,
            List<String> pickupAddresses,
            String destinationAddress) {
        StringBuilder raw = new StringBuilder(128);
        raw.append("home:")
                .append(homePlaceId)
                .append('|')
                .append(formatCoord(homeLat))
                .append(',')
                .append(formatCoord(homeLng))
                .append('|')
                .append(normalize(homeAddress));
        if (pickupAddresses != null) {
            for (String pickup : pickupAddresses) {
                raw.append("|pickup:").append(normalize(pickup));
            }
        }
        raw.append("|dest:").append(normalize(destinationAddress));
        return sha256Hex(raw.toString());
    }

    /**
     * Folds soft-skipped pickup geocodes into the fingerprint while staying at
     * 64 hex chars ({@code leaveby_itineraries.stop_fingerprint} VARCHAR(64)).
     * Appending a suffix to the SHA would overflow the column and 500 on accept.
     */
    static String withSoftSkippedPickups(
            String baseFingerprint, int locatedPickups, int attemptedPickups) {
        if (attemptedPickups <= locatedPickups) {
            return baseFingerprint;
        }
        return sha256Hex(
                baseFingerprint + "|geo:" + locatedPickups + "/" + attemptedPickups);
    }

    static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String formatCoord(double value) {
        return String.format(Locale.ROOT, "%.6f", value);
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
