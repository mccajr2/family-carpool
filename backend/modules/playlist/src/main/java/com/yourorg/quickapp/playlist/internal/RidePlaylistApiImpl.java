package com.yourorg.quickapp.playlist.internal;

import com.yourorg.quickapp.playlist.RidePlaylistApi;
import com.yourorg.quickapp.playlist.RidePlaylistAttendingKid;
import com.yourorg.quickapp.playlist.RidePlaylistInviteContactDto;
import com.yourorg.quickapp.playlist.RidePlaylistRiderDto;
import com.yourorg.quickapp.playlist.RidePlaylistTrackDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class RidePlaylistApiImpl implements RidePlaylistApi {

    private static final Logger log = LoggerFactory.getLogger(RidePlaylistApiImpl.class);

    private final SpotifyKidDesignationRepository designationRepository;
    private final SpotifyOAuthService oauthService;
    private final SpotifyOAuthPort oauthPort;

    RidePlaylistApiImpl(
            SpotifyKidDesignationRepository designationRepository,
            SpotifyOAuthService oauthService,
            SpotifyOAuthPort oauthPort) {
        this.designationRepository = designationRepository;
        this.oauthService = oauthService;
        this.oauthPort = oauthPort;
    }

    @Override
    @Transactional
    public List<RidePlaylistRiderDto> enrichRiders(
            UUID viewerAdultId, List<RidePlaylistAttendingKid> attendingKids) {
        if (attendingKids == null || attendingKids.isEmpty()) {
            return List.of();
        }
        List<UUID> kidIds =
                attendingKids.stream().map(RidePlaylistAttendingKid::kidId).distinct().toList();
        Map<UUID, SpotifyKidDesignationEntity> byKid = pickDesignations(viewerAdultId, kidIds);

        List<RidePlaylistRiderDto> out = new ArrayList<>(attendingKids.size());
        for (RidePlaylistAttendingKid kid : attendingKids) {
            SpotifyKidDesignationEntity designation = byKid.get(kid.kidId());
            if (designation == null) {
                out.add(disconnected(kid));
                continue;
            }
            out.add(connected(kid, designation));
        }
        return List.copyOf(out);
    }

    private Map<UUID, SpotifyKidDesignationEntity> pickDesignations(
            UUID viewerAdultId, List<UUID> kidIds) {
        List<SpotifyKidDesignationEntity> rows = designationRepository.findByKidIdIn(kidIds);
        Map<UUID, SpotifyKidDesignationEntity> byKid = new HashMap<>();
        for (SpotifyKidDesignationEntity row : rows) {
            SpotifyKidDesignationEntity existing = byKid.get(row.kidId());
            if (existing == null) {
                byKid.put(row.kidId(), row);
                continue;
            }
            // Prefer the viewer's own designation over another adult's.
            if (viewerAdultId.equals(row.adultId()) && !viewerAdultId.equals(existing.adultId())) {
                byKid.put(row.kidId(), row);
            }
        }
        return byKid;
    }

    private RidePlaylistRiderDto disconnected(RidePlaylistAttendingKid kid) {
        String to =
                kid.inviteLabel() == null || kid.inviteLabel().isBlank()
                        ? kid.displayName()
                        : kid.inviteLabel();
        return new RidePlaylistRiderDto(
                kid.kidId(),
                kid.displayName(),
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                new RidePlaylistInviteContactDto("push", to));
    }

    private RidePlaylistRiderDto connected(
            RidePlaylistAttendingKid kid, SpotifyKidDesignationEntity designation) {
        List<RidePlaylistTrackDto> tracks = List.of();
        Integer durationSec = null;
        Optional<String> accessToken = oauthService.accessToken(designation.adultId());
        if (accessToken.isPresent()) {
            try {
                List<SpotifyTrackInfo> fetched =
                        oauthPort.listPlaylistTracks(
                                accessToken.get(), designation.spotifyPlaylistId());
                tracks =
                        fetched.stream()
                                .map(
                                        t ->
                                                new RidePlaylistTrackDto(
                                                        t.title(),
                                                        t.artist(),
                                                        t.durationSec(),
                                                        t.uri()))
                                .toList();
                durationSec = tracks.stream().mapToInt(RidePlaylistTrackDto::durationSec).sum();
            } catch (Exception ex) {
                log.warn(
                        "Spotify track fetch failed for playlist {}; showing metadata only",
                        designation.spotifyPlaylistId());
            }
        }
        return new RidePlaylistRiderDto(
                kid.kidId(),
                kid.displayName(),
                true,
                designation.adultId(),
                designation.spotifyPlaylistId(),
                designation.playlistName(),
                designation.playlistUrl(),
                designation.trackCount(),
                durationSec,
                tracks,
                null);
    }
}
