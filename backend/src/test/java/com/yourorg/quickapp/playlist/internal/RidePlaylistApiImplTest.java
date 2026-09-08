package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.playlist.RidePlaylistAttendingKid;
import com.yourorg.quickapp.playlist.RidePlaylistRiderDto;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RidePlaylistApiImplTest {

    private static final UUID VIEWER = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID KID_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID KID_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    @Mock
    private SpotifyKidDesignationRepository designationRepository;

    @Mock
    private SpotifyOAuthService oauthService;

    @Mock
    private SpotifyOAuthPort oauthPort;

    private RidePlaylistApiImpl api;

    @BeforeEach
    void setUp() {
        api = new RidePlaylistApiImpl(designationRepository, oauthService, oauthPort);
    }

    @Test
    void enrichRidersMarksUnconnectedWithInviteContact() {
        when(designationRepository.findByKidIdIn(List.of(KID_A))).thenReturn(List.of());

        List<RidePlaylistRiderDto> riders =
                api.enrichRiders(
                        VIEWER, List.of(new RidePlaylistAttendingKid(KID_A, "Kwame", "the Oseis")));

        assertThat(riders).hasSize(1);
        assertThat(riders.getFirst().connected()).isFalse();
        assertThat(riders.getFirst().inviteContact().channel()).isEqualTo("push");
        assertThat(riders.getFirst().inviteContact().to()).isEqualTo("the Oseis");
        assertThat(riders.getFirst().tracks()).isEmpty();
        verify(oauthPort, never()).listPlaylistTracks(any(), any());
    }

    @Test
    void enrichRidersPrefersViewerDesignationAndLoadsTracks() {
        SpotifyKidDesignationEntity viewerDes =
                new SpotifyKidDesignationEntity(
                        VIEWER,
                        KID_A,
                        "stub-playlist-a",
                        "Sam gameday",
                        "https://open.spotify.com/playlist/stub-playlist-a",
                        12,
                        Instant.parse("2026-09-07T12:00:00Z"));
        SpotifyKidDesignationEntity otherDes =
                new SpotifyKidDesignationEntity(
                        OTHER,
                        KID_A,
                        "stub-playlist-b",
                        "Other mix",
                        "https://open.spotify.com/playlist/stub-playlist-b",
                        8,
                        Instant.parse("2026-09-07T11:00:00Z"));
        when(designationRepository.findByKidIdIn(List.of(KID_A)))
                .thenReturn(List.of(otherDes, viewerDes));
        when(oauthService.accessToken(VIEWER)).thenReturn(Optional.of("tok"));
        when(oauthPort.listPlaylistTracks("tok", "stub-playlist-a"))
                .thenReturn(
                        List.of(
                                new SpotifyTrackInfo(
                                        "Sunset Drive", "Coastline", 198, "spotify:track:a1")));

        List<RidePlaylistRiderDto> riders =
                api.enrichRiders(
                        VIEWER, List.of(new RidePlaylistAttendingKid(KID_A, "Sam", "House")));

        assertThat(riders.getFirst().connected()).isTrue();
        assertThat(riders.getFirst().designatingAdultId()).isEqualTo(VIEWER);
        assertThat(riders.getFirst().playlistName()).isEqualTo("Sam gameday");
        assertThat(riders.getFirst().tracks()).hasSize(1);
        assertThat(riders.getFirst().durationSec()).isEqualTo(198);
        assertThat(riders.getFirst().inviteContact()).isNull();
    }

    @Test
    void enrichRidersSoftFailsTracksWhenTokenMissing() {
        SpotifyKidDesignationEntity des =
                new SpotifyKidDesignationEntity(
                        OTHER,
                        KID_B,
                        "stub-playlist-b",
                        "Jordan warmup",
                        "https://open.spotify.com/playlist/stub-playlist-b",
                        8,
                        Instant.parse("2026-09-07T12:00:00Z"));
        when(designationRepository.findByKidIdIn(List.of(KID_B))).thenReturn(List.of(des));
        when(oauthService.accessToken(OTHER)).thenReturn(Optional.empty());

        List<RidePlaylistRiderDto> riders =
                api.enrichRiders(
                        VIEWER, List.of(new RidePlaylistAttendingKid(KID_B, "Jordan", "House")));

        assertThat(riders.getFirst().connected()).isTrue();
        assertThat(riders.getFirst().playlistName()).isEqualTo("Jordan warmup");
        assertThat(riders.getFirst().tracks()).isEmpty();
        assertThat(riders.getFirst().durationSec()).isNull();
        verify(oauthPort, never()).listPlaylistTracks(any(), eq("stub-playlist-b"));
    }
}
