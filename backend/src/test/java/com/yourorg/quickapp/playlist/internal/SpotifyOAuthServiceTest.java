package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.playlist.SpotifyAuthorizeResponse;
import com.yourorg.quickapp.playlist.SpotifyConnectionStatusResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class SpotifyOAuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-07T12:00:00Z");
    private static final UUID ADULT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock
    private SpotifyOAuthPort oauthPort;

    @Mock
    private SpotifyConnectionRepository connectionRepository;

    @Mock
    private SpotifyOAuthStateRepository stateRepository;

    @Mock
    private SpotifyKidDesignationRepository designationRepository;

    private TokenEncryptor tokenEncryptor;
    private SpotifyOAuthService service;

    @BeforeEach
    void setUp() {
        SpotifyProperties properties =
                new SpotifyProperties(
                        "test-client-id",
                        "test-secret",
                        "http://localhost:8080/api/playlist/spotify/callback",
                        "http://localhost:5173/app",
                        "dev-only-change-me!!-32b-aes-key",
                        "https://accounts.spotify.com/authorize",
                        "https://accounts.spotify.com/api/token",
                        "https://api.spotify.com/v1",
                        "playlist-read-private playlist-modify-private");
        tokenEncryptor = new TokenEncryptor(properties);
        service =
                new SpotifyOAuthService(
                        properties,
                        oauthPort,
                        connectionRepository,
                        stateRepository,
                        designationRepository,
                        tokenEncryptor,
                        Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void beginAuthorizePersistsStateAndBuildsUrl() {
        SpotifyAuthorizeResponse response = service.beginAuthorize(ADULT_ID);

        ArgumentCaptor<SpotifyOAuthStateEntity> stateCaptor =
                ArgumentCaptor.forClass(SpotifyOAuthStateEntity.class);
        verify(stateRepository).save(stateCaptor.capture());
        assertThat(stateCaptor.getValue().adultId()).isEqualTo(ADULT_ID);
        assertThat(stateCaptor.getValue().state()).isEqualTo(response.state());
        assertThat(response.authorizeUrl())
                .startsWith("https://accounts.spotify.com/authorize?")
                .contains("client_id=test-client-id")
                .contains("response_type=code")
                .contains("state=" + response.state())
                .contains("scope=playlist-read-private");
    }

    @Test
    void beginAuthorizeRequiresClientId() {
        SpotifyProperties blankClient =
                new SpotifyProperties(
                        "  ",
                        "secret",
                        "http://localhost/callback",
                        "http://localhost/success",
                        "dev-only-change-me!!-32b-aes-key",
                        "https://accounts.spotify.com/authorize",
                        "https://accounts.spotify.com/api/token",
                        "https://api.spotify.com/v1",
                        "playlist-read-private");
        SpotifyOAuthService blankService =
                new SpotifyOAuthService(
                        blankClient,
                        oauthPort,
                        connectionRepository,
                        stateRepository,
                        designationRepository,
                        new TokenEncryptor(blankClient),
                        Clock.fixed(NOW, ZoneOffset.UTC));

        assertThatThrownBy(() -> blankService.beginAuthorize(ADULT_ID))
                .isInstanceOf(PlaylistException.class)
                .extracting(ex -> ((PlaylistException) ex).status())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void completeCallbackStoresEncryptedTokensAndReturnsRedirect() {
        when(stateRepository.findById("abc123"))
                .thenReturn(
                        Optional.of(
                                new SpotifyOAuthStateEntity(
                                        "abc123", ADULT_ID, NOW.plusSeconds(600), NOW)));
        when(oauthPort.exchangeAuthorizationCode("auth-code"))
                .thenReturn(new SpotifyTokenResponse("access-1", "refresh-1", 3600));
        when(oauthPort.fetchCurrentUserId("access-1")).thenReturn("spotify-user-9");
        when(connectionRepository.findById(ADULT_ID)).thenReturn(Optional.empty());

        String redirect = service.completeCallback("auth-code", "abc123");

        assertThat(redirect).isEqualTo("http://localhost:5173/app?spotify=connected");
        verify(stateRepository).delete(any(SpotifyOAuthStateEntity.class));
        ArgumentCaptor<SpotifyConnectionEntity> captor =
                ArgumentCaptor.forClass(SpotifyConnectionEntity.class);
        verify(connectionRepository).save(captor.capture());
        SpotifyConnectionEntity saved = captor.getValue();
        assertThat(saved.adultId()).isEqualTo(ADULT_ID);
        assertThat(saved.spotifyUserId()).isEqualTo("spotify-user-9");
        assertThat(saved.accessTokenCiphertext()).isNotEqualTo("access-1");
        assertThat(tokenEncryptor.decrypt(saved.accessTokenCiphertext())).isEqualTo("access-1");
        assertThat(tokenEncryptor.decrypt(saved.refreshTokenCiphertext())).isEqualTo("refresh-1");
        assertThat(saved.accessTokenExpiresAt()).isEqualTo(NOW.plusSeconds(3600));
    }

    @Test
    void completeCallbackRejectsUnknownState() {
        when(stateRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.completeCallback("code", "missing"))
                .isInstanceOf(PlaylistException.class)
                .hasMessageContaining("Unknown or expired");
        verify(oauthPort, never()).exchangeAuthorizationCode(anyString());
    }

    @Test
    void revokeDeletesDesignationsAndConnection() {
        service.revoke(ADULT_ID);
        verify(designationRepository).deleteByAdultId(ADULT_ID);
        verify(connectionRepository).deleteById(ADULT_ID);
    }

    @Test
    void statusReportsDisconnectedWhenMissing() {
        when(connectionRepository.findById(ADULT_ID)).thenReturn(Optional.empty());
        SpotifyConnectionStatusResponse status = service.status(ADULT_ID);
        assertThat(status.connected()).isFalse();
        assertThat(status.spotifyUserId()).isNull();
    }

    @Test
    void accessTokenRefreshesWhenNearExpiry() {
        SpotifyConnectionEntity connection =
                new SpotifyConnectionEntity(
                        ADULT_ID,
                        "user-1",
                        tokenEncryptor.encrypt("old-access"),
                        tokenEncryptor.encrypt("refresh-keep"),
                        NOW.plusSeconds(30),
                        NOW.minusSeconds(3600));
        when(connectionRepository.findById(ADULT_ID)).thenReturn(Optional.of(connection));
        when(oauthPort.refreshAccessToken("refresh-keep"))
                .thenReturn(new SpotifyTokenResponse("new-access", null, 3600));

        Optional<String> token = service.accessToken(ADULT_ID);

        assertThat(token).contains("new-access");
        assertThat(tokenEncryptor.decrypt(connection.accessTokenCiphertext())).isEqualTo("new-access");
        assertThat(tokenEncryptor.decrypt(connection.refreshTokenCiphertext()))
                .isEqualTo("refresh-keep");
        verify(connectionRepository).save(connection);
    }

    @Test
    void accessTokenSkipsRefreshWhenStillFresh() {
        SpotifyConnectionEntity connection =
                new SpotifyConnectionEntity(
                        ADULT_ID,
                        "user-1",
                        tokenEncryptor.encrypt("fresh-access"),
                        tokenEncryptor.encrypt("refresh-keep"),
                        NOW.plusSeconds(3600),
                        NOW);
        when(connectionRepository.findById(ADULT_ID)).thenReturn(Optional.of(connection));

        assertThat(service.accessToken(ADULT_ID)).contains("fresh-access");
        verify(oauthPort, never()).refreshAccessToken(anyString());
    }
}
