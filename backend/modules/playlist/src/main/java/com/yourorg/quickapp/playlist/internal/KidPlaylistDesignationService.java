package com.yourorg.quickapp.playlist.internal;

import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.playlist.KidPlaylistDesignationResponse;
import com.yourorg.quickapp.playlist.SpotifyPlaylistOptionResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KidPlaylistDesignationService {

    private final FamilyMembershipApi membershipApi;
    private final SpotifyOAuthService oauthService;
    private final SpotifyOAuthPort oauthPort;
    private final SpotifyKidDesignationRepository designationRepository;
    private final Clock clock;

    KidPlaylistDesignationService(
            FamilyMembershipApi membershipApi,
            SpotifyOAuthService oauthService,
            SpotifyOAuthPort oauthPort,
            SpotifyKidDesignationRepository designationRepository,
            Clock clock) {
        this.membershipApi = membershipApi;
        this.oauthService = oauthService;
        this.oauthPort = oauthPort;
        this.designationRepository = designationRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<SpotifyPlaylistOptionResponse> listSpotifyPlaylists(UUID adultId) {
        String accessToken = requireAccessToken(adultId);
        return oauthPort.listPlaylists(accessToken).stream()
                .map(
                        p ->
                                new SpotifyPlaylistOptionResponse(
                                        p.id(), p.name(), p.url(), p.trackCount()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<KidPlaylistDesignationResponse> listDesignations(UUID adultId) {
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        List<SpotifyKidDesignationEntity> rows =
                designationRepository.findByAdultIdOrderByUpdatedAtDesc(adultId);
        if (rows.isEmpty()) {
            return List.of();
        }
        List<UUID> kidIds = rows.stream().map(SpotifyKidDesignationEntity::kidId).toList();
        Map<UUID, FamilyKidName> kidsById =
                membershipApi.findKids(circleId, kidIds).stream()
                        .collect(Collectors.toMap(FamilyKidName::id, Function.identity()));
        List<KidPlaylistDesignationResponse> out = new ArrayList<>();
        for (SpotifyKidDesignationEntity row : rows) {
            FamilyKidName kid = kidsById.get(row.kidId());
            if (kid == null) {
                // Kid left the circle; skip orphan designation (cleaned on next set/revoke).
                continue;
            }
            out.add(toResponse(row, kid.displayName()));
        }
        return out;
    }

    @Transactional
    public KidPlaylistDesignationResponse setDesignation(
            UUID adultId, UUID kidId, String spotifyPlaylistId) {
        if (spotifyPlaylistId == null || spotifyPlaylistId.isBlank()) {
            throw new PlaylistException(HttpStatus.BAD_REQUEST, "spotifyPlaylistId must not be blank");
        }
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        membershipApi.requireKidsInCircle(circleId, List.of(kidId));
        String accessToken = requireAccessToken(adultId);
        SpotifyPlaylistInfo playlist = oauthPort.getPlaylist(accessToken, spotifyPlaylistId.trim());
        Instant now = Instant.now(clock);
        Optional<SpotifyKidDesignationEntity> existing =
                designationRepository.findByAdultIdAndKidId(adultId, kidId);
        SpotifyKidDesignationEntity entity;
        if (existing.isPresent()) {
            entity = existing.get();
            entity.replacePlaylist(
                    playlist.id(),
                    truncate(playlist.name(), 200),
                    truncate(playlist.url(), 512),
                    playlist.trackCount(),
                    now);
        } else {
            entity =
                    new SpotifyKidDesignationEntity(
                            adultId,
                            kidId,
                            playlist.id(),
                            truncate(playlist.name(), 200),
                            truncate(playlist.url(), 512),
                            playlist.trackCount(),
                            now);
        }
        designationRepository.save(entity);
        String displayName =
                membershipApi.findKids(circleId, List.of(kidId)).stream()
                        .findFirst()
                        .map(FamilyKidName::displayName)
                        .orElse("Kid");
        return toResponse(entity, displayName);
    }

    @Transactional
    public void clearDesignation(UUID adultId, UUID kidId) {
        UUID circleId = membershipApi.requireMemberCircleId(adultId);
        membershipApi.requireKidsInCircle(circleId, List.of(kidId));
        designationRepository.deleteByAdultIdAndKidId(adultId, kidId);
    }

    @Transactional
    public void clearAllForAdult(UUID adultId) {
        designationRepository.deleteByAdultId(adultId);
    }

    private String requireAccessToken(UUID adultId) {
        return oauthService
                .accessToken(adultId)
                .orElseThrow(
                        () ->
                                new PlaylistException(
                                        HttpStatus.CONFLICT, "Spotify is not connected for this adult"));
    }

    private static KidPlaylistDesignationResponse toResponse(
            SpotifyKidDesignationEntity row, String kidDisplayName) {
        return new KidPlaylistDesignationResponse(
                row.kidId(),
                kidDisplayName,
                row.spotifyPlaylistId(),
                row.playlistName(),
                row.playlistUrl(),
                row.trackCount());
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
