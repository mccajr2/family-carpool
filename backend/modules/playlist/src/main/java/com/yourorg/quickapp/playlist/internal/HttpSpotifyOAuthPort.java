package com.yourorg.quickapp.playlist.internal;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Objects;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
@ConditionalOnProperty(name = "app.spotify.oauth-provider", havingValue = "http", matchIfMissing = true)
class HttpSpotifyOAuthPort implements SpotifyOAuthPort {

    private static final JsonMapper MAPPER = JsonMapper.shared();
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

    private final RestClient restClient;
    private final SpotifyProperties properties;

    HttpSpotifyOAuthPort(SpotifyProperties properties) {
        this.properties = properties;
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(
                        HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build());
        requestFactory.setReadTimeout(READ_TIMEOUT);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    @Override
    public SpotifyTokenResponse exchangeAuthorizationCode(String code) {
        String body =
                UriComponentsBuilder.newInstance()
                        .queryParam("grant_type", "authorization_code")
                        .queryParam("code", code)
                        .queryParam("redirect_uri", properties.redirectUri())
                        .build()
                        .encode()
                        .toUri()
                        .getRawQuery();
        return postToken(body);
    }

    @Override
    public SpotifyTokenResponse refreshAccessToken(String refreshToken) {
        String body =
                UriComponentsBuilder.newInstance()
                        .queryParam("grant_type", "refresh_token")
                        .queryParam("refresh_token", refreshToken)
                        .build()
                        .encode()
                        .toUri()
                        .getRawQuery();
        SpotifyTokenResponse refreshed = postToken(body);
        if (refreshed.refreshToken() == null || refreshed.refreshToken().isBlank()) {
            return new SpotifyTokenResponse(
                    refreshed.accessToken(), refreshToken, refreshed.expiresInSeconds());
        }
        return refreshed;
    }

    @Override
    public String fetchCurrentUserId(String accessToken) {
        String json =
                restClient
                        .get()
                        .uri(trimTrailingSlash(properties.apiBaseUrl()) + "/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .retrieve()
                        .body(String.class);
        if (json == null || json.isBlank()) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify /me returned empty body");
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            String id = text(root, "id");
            if (id == null || id.isBlank()) {
                throw new PlaylistException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Spotify /me missing id");
            }
            return id;
        } catch (PlaylistException e) {
            throw e;
        } catch (Exception e) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify /me response was not valid JSON");
        }
    }

    @Override
    public java.util.List<SpotifyPlaylistInfo> listPlaylists(String accessToken) {
        String json =
                authorizedGet(
                        accessToken,
                        trimTrailingSlash(properties.apiBaseUrl()) + "/me/playlists?limit=50");
        return parsePlaylistPage(json);
    }

    @Override
    public SpotifyPlaylistInfo getPlaylist(String accessToken, String playlistId) {
        if (playlistId == null || playlistId.isBlank()) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "playlistId is required");
        }
        String json =
                authorizedGet(
                        accessToken,
                        trimTrailingSlash(properties.apiBaseUrl()) + "/playlists/" + playlistId);
        try {
            JsonNode root = MAPPER.readTree(json);
            SpotifyPlaylistInfo info = parsePlaylistNode(root);
            if (info == null) {
                throw new PlaylistException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Spotify playlist response missing id");
            }
            return info;
        } catch (PlaylistException e) {
            throw e;
        } catch (Exception e) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify playlist response was not valid JSON");
        }
    }

    private String authorizedGet(String accessToken, String uri) {
        try {
            String json =
                    restClient
                            .get()
                            .uri(uri)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                            .retrieve()
                            .body(String.class);
            if (json == null || json.isBlank()) {
                throw new PlaylistException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Spotify API returned empty body");
            }
            return json;
        } catch (PlaylistException e) {
            throw e;
        } catch (Exception e) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY, "Spotify API request failed");
        }
    }

    static java.util.List<SpotifyPlaylistInfo> parsePlaylistPage(String json) {
        if (json == null || json.isBlank()) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify playlists response was empty");
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            JsonNode items = root.get("items");
            java.util.ArrayList<SpotifyPlaylistInfo> out = new java.util.ArrayList<>();
            if (items == null || !items.isArray()) {
                return out;
            }
            for (JsonNode item : items) {
                SpotifyPlaylistInfo info = parsePlaylistNode(item);
                if (info != null) {
                    out.add(info);
                }
            }
            return out;
        } catch (PlaylistException e) {
            throw e;
        } catch (Exception e) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify playlists response was not valid JSON");
        }
    }

    static SpotifyPlaylistInfo parsePlaylistNode(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        String id = text(node, "id");
        if (id == null || id.isBlank()) {
            return null;
        }
        String name = text(node, "name");
        if (name == null || name.isBlank()) {
            name = "Untitled playlist";
        }
        String url = null;
        JsonNode external = node.get("external_urls");
        if (external != null && !external.isNull()) {
            url = text(external, "spotify");
        }
        if (url == null || url.isBlank()) {
            url = "https://open.spotify.com/playlist/" + id;
        }
        int trackCount = 0;
        JsonNode tracks = node.get("tracks");
        if (tracks != null && !tracks.isNull()) {
            trackCount = tracks.path("total").asInt(0);
        }
        return new SpotifyPlaylistInfo(id, name, url, trackCount);
    }

    private SpotifyTokenResponse postToken(String formBody) {
        String credentials =
                properties.clientId() + ":" + Objects.requireNonNullElse(properties.clientSecret(), "");
        String basic =
                "Basic "
                        + Base64.getEncoder()
                                .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
        String json;
        try {
            json =
                    restClient
                            .post()
                            .uri(properties.tokenUrl())
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .header(HttpHeaders.AUTHORIZATION, basic)
                            .body(formBody)
                            .retrieve()
                            .body(String.class);
        } catch (Exception e) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify token exchange failed");
        }
        return parseTokenResponse(json);
    }

    static SpotifyTokenResponse parseTokenResponse(String json) {
        if (json == null || json.isBlank()) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify token response was empty");
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            String access = text(root, "access_token");
            if (access == null || access.isBlank()) {
                throw new PlaylistException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Spotify token response missing access_token");
            }
            String refresh = text(root, "refresh_token");
            int expiresIn = root.path("expires_in").asInt(3600);
            return new SpotifyTokenResponse(access, refresh, expiresIn);
        } catch (PlaylistException e) {
            throw e;
        } catch (Exception e) {
            throw new PlaylistException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Spotify token response was not valid JSON");
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private static String trimTrailingSlash(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
