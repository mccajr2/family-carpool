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
