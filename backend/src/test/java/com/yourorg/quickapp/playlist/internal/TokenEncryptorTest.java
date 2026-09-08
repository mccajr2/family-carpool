package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TokenEncryptorTest {

    @Test
    void roundTripsPlaintext() {
        TokenEncryptor encryptor = new TokenEncryptor(props("dev-only-change-me!!-32b-aes-key"));
        String cipher = encryptor.encrypt("spotify-refresh-token");
        assertThat(cipher).isNotEqualTo("spotify-refresh-token");
        assertThat(encryptor.decrypt(cipher)).isEqualTo("spotify-refresh-token");
    }

    @Test
    void samePlaintextYieldsDifferentCiphertexts() {
        TokenEncryptor encryptor = new TokenEncryptor(props("dev-only-change-me!!-32b-aes-key"));
        assertThat(encryptor.encrypt("same")).isNotEqualTo(encryptor.encrypt("same"));
    }

    @Test
    void rejectsWrongKeyLengthOnConstruction() {
        assertThatThrownBy(() -> new TokenEncryptor(props("too-short")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly 32");
    }

    private static SpotifyProperties props(String key) {
        return new SpotifyProperties(
                "client",
                "secret",
                "http://localhost/callback",
                "http://localhost/success",
                key,
                "https://accounts.spotify.com/authorize",
                "https://accounts.spotify.com/api/token",
                "https://api.spotify.com/v1",
                "playlist-read-private");
    }
}
