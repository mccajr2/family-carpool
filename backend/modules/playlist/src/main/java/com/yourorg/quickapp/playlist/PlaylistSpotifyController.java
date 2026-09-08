package com.yourorg.quickapp.playlist;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.playlist.internal.KidPlaylistDesignationService;
import com.yourorg.quickapp.playlist.internal.SpotifyOAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/playlist")
public class PlaylistSpotifyController {

    private final AdultSessionApi adultSessionApi;
    private final SpotifyOAuthService oauthService;
    private final KidPlaylistDesignationService designationService;

    public PlaylistSpotifyController(
            AdultSessionApi adultSessionApi,
            SpotifyOAuthService oauthService,
            KidPlaylistDesignationService designationService) {
        this.adultSessionApi = adultSessionApi;
        this.oauthService = oauthService;
        this.designationService = designationService;
    }

    @GetMapping("/spotify/authorize")
    public SpotifyAuthorizeResponse authorize(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return oauthService.beginAuthorize(adult.id());
    }

    /**
     * Spotify redirects here (no Bearer). State binds the flow to the adult who
     * started authorize; on success the browser is sent to the configured
     * frontend success URL.
     */
    @GetMapping("/spotify/callback")
    public ResponseEntity<Void> callback(
            @RequestParam("code") String code, @RequestParam("state") String state) {
        String redirect = oauthService.completeCallback(code, state);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirect)).build();
    }

    @GetMapping("/spotify/status")
    public SpotifyConnectionStatusResponse status(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return oauthService.status(adult.id());
    }

    @PostMapping("/spotify/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        oauthService.revoke(adult.id());
    }

    @GetMapping("/spotify/playlists")
    public List<SpotifyPlaylistOptionResponse> listPlaylists(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return designationService.listSpotifyPlaylists(adult.id());
    }

    @GetMapping("/designations")
    public List<KidPlaylistDesignationResponse> listDesignations(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return designationService.listDesignations(adult.id());
    }

    @PutMapping("/designations/{kidId}")
    public KidPlaylistDesignationResponse setDesignation(
            @PathVariable("kidId") UUID kidId,
            @Valid @RequestBody SetKidPlaylistDesignationRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return designationService.setDesignation(adult.id(), kidId, request.spotifyPlaylistId());
    }

    @DeleteMapping("/designations/{kidId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearDesignation(
            @PathVariable("kidId") UUID kidId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        designationService.clearDesignation(adult.id(), kidId);
    }
}
