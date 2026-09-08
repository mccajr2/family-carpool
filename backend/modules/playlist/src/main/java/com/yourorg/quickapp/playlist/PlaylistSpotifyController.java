package com.yourorg.quickapp.playlist;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.playlist.internal.SpotifyOAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/playlist/spotify")
public class PlaylistSpotifyController {

    private final AdultSessionApi adultSessionApi;
    private final SpotifyOAuthService oauthService;

    public PlaylistSpotifyController(
            AdultSessionApi adultSessionApi, SpotifyOAuthService oauthService) {
        this.adultSessionApi = adultSessionApi;
        this.oauthService = oauthService;
    }

    @GetMapping("/authorize")
    public SpotifyAuthorizeResponse authorize(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return oauthService.beginAuthorize(adult.id());
    }

    /**
     * Spotify redirects here (no Bearer). State binds the flow to the adult who
     * started authorize; on success the browser is sent to the configured
     * frontend success URL.
     */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam("code") String code, @RequestParam("state") String state) {
        String redirect = oauthService.completeCallback(code, state);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirect)).build();
    }

    @GetMapping("/status")
    public SpotifyConnectionStatusResponse status(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return oauthService.status(adult.id());
    }

    @PostMapping("/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        oauthService.revoke(adult.id());
    }
}
