package com.yourorg.quickapp.playlist.internal;

import com.yourorg.quickapp.playlist.SpotifyAuthorizeResponse;
import com.yourorg.quickapp.playlist.SpotifyConnectionStatusResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class SpotifyOAuthService {

    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final Duration ACCESS_TOKEN_SKEW = Duration.ofSeconds(60);

    private final SpotifyProperties properties;
    private final SpotifyOAuthPort oauthPort;
    private final SpotifyConnectionRepository connectionRepository;
    private final SpotifyOAuthStateRepository stateRepository;
    private final SpotifyKidDesignationRepository designationRepository;
    private final TokenEncryptor tokenEncryptor;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    SpotifyOAuthService(
            SpotifyProperties properties,
            SpotifyOAuthPort oauthPort,
            SpotifyConnectionRepository connectionRepository,
            SpotifyOAuthStateRepository stateRepository,
            SpotifyKidDesignationRepository designationRepository,
            TokenEncryptor tokenEncryptor,
            Clock clock) {
        this.properties = properties;
        this.oauthPort = oauthPort;
        this.connectionRepository = connectionRepository;
        this.stateRepository = stateRepository;
        this.designationRepository = designationRepository;
        this.tokenEncryptor = tokenEncryptor;
        this.clock = clock;
    }

    @Transactional
    public SpotifyAuthorizeResponse beginAuthorize(UUID adultId) {
        requireClientConfigured();
        Instant now = Instant.now(clock);
        String state = newState();
        stateRepository.save(new SpotifyOAuthStateEntity(state, adultId, now.plus(STATE_TTL), now));
        String authorizeUrl =
                UriComponentsBuilder.fromUriString(properties.authorizeUrl())
                        .queryParam("client_id", properties.clientId())
                        .queryParam("response_type", "code")
                        .queryParam("redirect_uri", properties.redirectUri())
                        .queryParam("scope", properties.scopes())
                        .queryParam("state", state)
                        .encode()
                        .build()
                        .toUriString();
        return new SpotifyAuthorizeResponse(authorizeUrl, state);
    }

    /**
     * Exchanges the authorization code, stores encrypted tokens, and returns the
     * frontend success redirect URL.
     */
    @Transactional
    public String completeCallback(String code, String state) {
        if (code == null || code.isBlank()) {
            throw new PlaylistException(HttpStatus.BAD_REQUEST, "code is required");
        }
        if (state == null || state.isBlank()) {
            throw new PlaylistException(HttpStatus.BAD_REQUEST, "state is required");
        }
        Instant now = Instant.now(clock);
        SpotifyOAuthStateEntity oauthState =
                stateRepository
                        .findById(state)
                        .orElseThrow(
                                () ->
                                        new PlaylistException(
                                                HttpStatus.BAD_REQUEST, "Unknown or expired OAuth state"));
        stateRepository.delete(oauthState);
        if (oauthState.expiresAt().isBefore(now)) {
            throw new PlaylistException(HttpStatus.BAD_REQUEST, "Unknown or expired OAuth state");
        }

        SpotifyTokenResponse tokens = oauthPort.exchangeAuthorizationCode(code);
        if (tokens.refreshToken() == null || tokens.refreshToken().isBlank()) {
            throw new PlaylistException(
                    HttpStatus.BAD_GATEWAY, "Spotify did not return a refresh_token");
        }
        String spotifyUserId = oauthPort.fetchCurrentUserId(tokens.accessToken());
        Instant expiresAt = now.plusSeconds(Math.max(tokens.expiresInSeconds(), 1));
        upsertConnection(
                oauthState.adultId(),
                spotifyUserId,
                tokens.accessToken(),
                tokens.refreshToken(),
                expiresAt,
                now);
        return successRedirectUrl();
    }

    @Transactional(readOnly = true)
    public SpotifyConnectionStatusResponse status(UUID adultId) {
        return connectionRepository
                .findById(adultId)
                .map(c -> new SpotifyConnectionStatusResponse(true, c.spotifyUserId()))
                .orElseGet(() -> new SpotifyConnectionStatusResponse(false, null));
    }

    @Transactional
    public void revoke(UUID adultId) {
        designationRepository.deleteByAdultId(adultId);
        connectionRepository.deleteById(adultId);
    }

    public boolean isConnected(UUID adultId) {
        return connectionRepository.existsById(adultId);
    }

    /**
     * Returns a usable access token, refreshing when within {@link #ACCESS_TOKEN_SKEW}
     * of expiry. Empty when the adult has no Spotify connection.
     */
    @Transactional
    public Optional<String> accessToken(UUID adultId) {
        Optional<SpotifyConnectionEntity> existing = connectionRepository.findById(adultId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        SpotifyConnectionEntity connection = existing.get();
        Instant now = Instant.now(clock);
        if (connection.accessTokenExpiresAt().isAfter(now.plus(ACCESS_TOKEN_SKEW))) {
            return Optional.of(tokenEncryptor.decrypt(connection.accessTokenCiphertext()));
        }
        String refreshToken = tokenEncryptor.decrypt(connection.refreshTokenCiphertext());
        SpotifyTokenResponse refreshed = oauthPort.refreshAccessToken(refreshToken);
        String newRefresh =
                refreshed.refreshToken() == null || refreshed.refreshToken().isBlank()
                        ? refreshToken
                        : refreshed.refreshToken();
        Instant expiresAt = now.plusSeconds(Math.max(refreshed.expiresInSeconds(), 1));
        connection.updateTokens(
                tokenEncryptor.encrypt(refreshed.accessToken()),
                tokenEncryptor.encrypt(newRefresh),
                expiresAt,
                now);
        connectionRepository.save(connection);
        return Optional.of(refreshed.accessToken());
    }

    private void upsertConnection(
            UUID adultId,
            String spotifyUserId,
            String accessToken,
            String refreshToken,
            Instant expiresAt,
            Instant now) {
        String accessCipher = tokenEncryptor.encrypt(accessToken);
        String refreshCipher = tokenEncryptor.encrypt(refreshToken);
        Optional<SpotifyConnectionEntity> existing = connectionRepository.findById(adultId);
        if (existing.isPresent()) {
            SpotifyConnectionEntity connection = existing.get();
            connection.replaceCredentials(
                    spotifyUserId, accessCipher, refreshCipher, expiresAt, now);
            connectionRepository.save(connection);
            return;
        }
        connectionRepository.save(
                new SpotifyConnectionEntity(
                        adultId, spotifyUserId, accessCipher, refreshCipher, expiresAt, now));
    }

    private void requireClientConfigured() {
        if (properties.clientId() == null || properties.clientId().isBlank()) {
            throw new PlaylistException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Spotify client id is not configured");
        }
    }

    private String newState() {
        byte[] bytes = new byte[24];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String successRedirectUrl() {
        String base = properties.successRedirectUri();
        if (base == null || base.isBlank()) {
            throw new PlaylistException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Spotify success redirect is not configured");
        }
        String sep = base.contains("?") ? "&" : "?";
        return base + sep + "spotify=" + URLEncoder.encode("connected", StandardCharsets.UTF_8);
    }
}
