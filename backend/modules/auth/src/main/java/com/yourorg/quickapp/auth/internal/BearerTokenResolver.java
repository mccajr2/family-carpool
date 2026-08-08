package com.yourorg.quickapp.auth.internal;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class BearerTokenResolver {

    public Optional<String> resolve(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || header.isBlank()) {
            return Optional.empty();
        }
        String prefix = "Bearer ";
        if (!header.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return Optional.empty();
        }
        String token = header.substring(prefix.length()).trim();
        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
