package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HttpSpotifyOAuthPortTest {

    @Test
    void parseTokenResponseReadsAccessRefreshAndExpiry() {
        SpotifyTokenResponse tokens =
                HttpSpotifyOAuthPort.parseTokenResponse(
                        """
                        {"access_token":"a1","token_type":"Bearer","expires_in":7200,"refresh_token":"r1"}
                        """);
        assertThat(tokens.accessToken()).isEqualTo("a1");
        assertThat(tokens.refreshToken()).isEqualTo("r1");
        assertThat(tokens.expiresInSeconds()).isEqualTo(7200);
    }

    @Test
    void parseTokenResponseAllowsMissingRefresh() {
        SpotifyTokenResponse tokens =
                HttpSpotifyOAuthPort.parseTokenResponse(
                        """
                        {"access_token":"a1","expires_in":3600}
                        """);
        assertThat(tokens.accessToken()).isEqualTo("a1");
        assertThat(tokens.refreshToken()).isNull();
    }

    @Test
    void parseTokenResponseRejectsMissingAccess() {
        assertThatThrownBy(() -> HttpSpotifyOAuthPort.parseTokenResponse("{\"expires_in\":1}"))
                .isInstanceOf(PlaylistException.class)
                .extracting(ex -> ((PlaylistException) ex).status())
                .isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void parsePlaylistPageReadsItems() {
        List<SpotifyPlaylistInfo> playlists =
                HttpSpotifyOAuthPort.parsePlaylistPage(
                        """
                        {"items":[{"id":"p1","name":"Mix","external_urls":{"spotify":"https://open.spotify.com/playlist/p1"},"tracks":{"total":4}}]}
                        """);
        assertThat(playlists).hasSize(1);
        assertThat(playlists.getFirst().id()).isEqualTo("p1");
        assertThat(playlists.getFirst().trackCount()).isEqualTo(4);
        assertThat(playlists.getFirst().url()).isEqualTo("https://open.spotify.com/playlist/p1");
    }
}
