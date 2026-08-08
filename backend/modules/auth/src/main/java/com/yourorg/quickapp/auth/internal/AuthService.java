package com.yourorg.quickapp.auth.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AuthSessionResponse;
import com.yourorg.quickapp.auth.RequestAuthCodeResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthProperties properties;
    private final AdultRepository adults;
    private final AuthCodeRepository codes;
    private final AuthSessionRepository sessions;
    private final AuthMailPort mailPort;
    private final SecretHasher hasher;
    private final AuthRateLimiter rateLimiter;
    private final Clock clock;

    public AuthService(
            AuthProperties properties,
            AdultRepository adults,
            AuthCodeRepository codes,
            AuthSessionRepository sessions,
            AuthMailPort mailPort,
            SecretHasher hasher,
            AuthRateLimiter rateLimiter,
            Clock clock) {
        this.properties = properties;
        this.adults = adults;
        this.codes = codes;
        this.sessions = sessions;
        this.mailPort = mailPort;
        this.hasher = hasher;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
    }

    @Transactional
    public RequestAuthCodeResponse requestCode(String rawEmail, String clientKey) {
        String email = BearerTokenResolver.normalizeEmail(rawEmail);
        if (!rateLimiter.tryConsume(
                "request:" + email + ":" + clientKey,
                properties.requestCodeLimit(),
                properties.requestCodeWindowSeconds())) {
            throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "Too many code requests");
        }

        String code = hasher.newNumericCode(properties.codeLength());
        Instant now = clock.instant();
        AuthCodeEntity entity =
                new AuthCodeEntity(
                        UUID.randomUUID(),
                        email,
                        hasher.hash(code),
                        now.plusSeconds(properties.codeTtlSeconds()),
                        now);
        codes.save(entity);
        mailPort.sendSignInCode(email, code);

        if (properties.devCodeEcho()) {
            return new RequestAuthCodeResponse(email, properties.codeTtlSeconds(), code);
        }
        return RequestAuthCodeResponse.withoutDevCode(email, properties.codeTtlSeconds());
    }

    @Transactional
    public AuthSessionResponse verifyCode(String rawEmail, String rawCode, String clientKey) {
        String email = BearerTokenResolver.normalizeEmail(rawEmail);
        String code = rawCode.trim();
        if (!rateLimiter.tryConsume(
                "verify:" + email + ":" + clientKey,
                properties.verifyCodeLimit(),
                properties.verifyCodeWindowSeconds())) {
            throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "Too many verify attempts");
        }

        Instant now = clock.instant();
        List<AuthCodeEntity> candidates = codes.findByEmailOrderByCreatedAtDesc(email);
        AuthCodeEntity match = null;
        String codeHash = hasher.hash(code);
        for (AuthCodeEntity candidate : candidates) {
            if (candidate.consumedAt() != null) {
                continue;
            }
            if (candidate.expiresAt().isBefore(now)) {
                continue;
            }
            if (candidate.codeHash().equals(codeHash)) {
                match = candidate;
                break;
            }
        }
        if (match == null) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        match.consume(now);
        codes.save(match);

        AdultEntity adult =
                adults.findByEmail(email)
                        .orElseGet(
                                () -> adults.save(new AdultEntity(UUID.randomUUID(), email, now)));

        String accessToken = hasher.newOpaqueToken();
        AuthSessionEntity session =
                new AuthSessionEntity(
                        UUID.randomUUID(),
                        adult.id(),
                        hasher.hash(accessToken),
                        now.plusSeconds(properties.sessionTtlSeconds()),
                        now);
        sessions.save(session);

        return AuthSessionResponse.bearer(accessToken, toResponse(adult));
    }

    @Transactional(readOnly = true)
    public AdultResponse currentAdult(String accessToken) {
        return toResponse(requireActiveSession(accessToken).adult());
    }

    @Transactional
    public void logout(String accessToken) {
        AuthSessionEntity session = requireActiveSession(accessToken).session();
        session.revoke(clock.instant());
        sessions.save(session);
    }

    public static AuthException unauthorized(String message) {
        return new AuthException(HttpStatus.UNAUTHORIZED, message);
    }

    private SessionAdult requireActiveSession(String accessToken) {
        Instant now = clock.instant();
        AuthSessionEntity session =
                sessions
                        .findByTokenHash(hasher.hash(accessToken))
                        .orElseThrow(() -> unauthorized("Missing or invalid Bearer token"));
        if (session.revokedAt() != null || session.expiresAt().isBefore(now)) {
            throw unauthorized("Missing or invalid Bearer token");
        }
        AdultEntity adult =
                adults.findById(session.adultId())
                        .orElseThrow(() -> unauthorized("Missing or invalid Bearer token"));
        return new SessionAdult(session, adult);
    }

    private static AdultResponse toResponse(AdultEntity adult) {
        return new AdultResponse(adult.id(), adult.email(), adult.displayName());
    }

    private record SessionAdult(AuthSessionEntity session, AdultEntity adult) {}
}
