package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.CalendarRouteMemberRef;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Deterministic cache key for a driving-block itinerary: ordered member
 * {@code source+itemId} list (independent of which path item opened Route).
 */
final class MemberSetKeys {

    private MemberSetKeys() {}

    static String compute(List<CalendarRouteMemberRef> members) {
        if (members == null || members.isEmpty()) {
            throw new IllegalArgumentException("member set must not be empty");
        }
        StringBuilder raw = new StringBuilder(64 * members.size());
        for (CalendarRouteMemberRef member : members) {
            raw.append(member.source().name()).append(':').append(member.itemId()).append('\n');
        }
        return sha256Hex(raw.toString());
    }

    /** Compact token list for invalidate-by-item ({@code SOURCE/uuid|…}). */
    static String membersToken(List<CalendarRouteMemberRef> members) {
        StringBuilder raw = new StringBuilder(48 * members.size());
        for (int i = 0; i < members.size(); i++) {
            if (i > 0) {
                raw.append('|');
            }
            CalendarRouteMemberRef member = members.get(i);
            raw.append(member.source().name()).append('/').append(member.itemId());
        }
        return raw.toString();
    }

    static boolean tokensContain(String membersToken, LeaveByItemSource source, UUID itemId) {
        if (membersToken == null || membersToken.isBlank() || source == null || itemId == null) {
            return false;
        }
        String needle = source.name() + "/" + itemId;
        for (String part : membersToken.split("\\|")) {
            if (needle.equals(part)) {
                return true;
            }
        }
        return false;
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
