package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
    private SpotifyConnectionRepository connectionRepository;

    @Mock
    private SpotifyOAuthService oauthService;

    @Mock
    private SpotifyOAuthPort oauthPort;

    private RidePlaylistApiImpl api;

    @BeforeEach
    void setUp() {
        api =
                new RidePlaylistApiImpl(
                        designationRepository, connectionRepository, oauthService, oauthPort);
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

    @Test
    void openHandoffSingleConnectedReturnsSourceUrl() {
        RidePlaylistRiderDto connected =
                new RidePlaylistRiderDto(
                        KID_A,
                        "Sam",
                        true,
                        VIEWER,
                        "stub-playlist-a",
                        "Sam gameday",
                        "https://open.spotify.com/playlist/stub-playlist-a",
                        12,
                        100,
                        List.of(),
                        null);
        RidePlaylistRiderDto disconnected =
                new RidePlaylistRiderDto(
                        KID_B,
                        "Jordan",
                        false,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        List.of(),
                        null);

        assertThat(api.openHandoff(VIEWER, List.of(connected, disconnected), null).url())
                .isEqualTo("https://open.spotify.com/playlist/stub-playlist-a");
        verify(oauthPort, never()).upsertMergePlaylist(any(), any(), any(), any());
    }

    @Test
    void openHandoffTwoPlusRequiresViewerSpotify() {
        RidePlaylistRiderDto a =
                new RidePlaylistRiderDto(
                        KID_A,
                        "Sam",
                        true,
                        VIEWER,
                        "stub-playlist-a",
                        "A",
                        "https://open.spotify.com/playlist/a",
                        1,
                        10,
                        List.of(
                                new com.yourorg.quickapp.playlist.RidePlaylistTrackDto(
                                        "T1", "Art", 10, "spotify:track:a1")),
                        null);
        RidePlaylistRiderDto b =
                new RidePlaylistRiderDto(
                        KID_B,
                        "Jordan",
                        true,
                        OTHER,
                        "stub-playlist-b",
                        "B",
                        "https://open.spotify.com/playlist/b",
                        1,
                        10,
                        List.of(
                                new com.yourorg.quickapp.playlist.RidePlaylistTrackDto(
                                        "T2", "Art", 10, "spotify:track:b1")),
                        null);
        when(oauthService.accessToken(VIEWER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> api.openHandoff(VIEWER, List.of(a, b), null))
                .isInstanceOf(PlaylistException.class)
                .hasMessageContaining("Spotify is not connected");
    }

    @Test
    void openHandoffTwoPlusCreatesMergeAndPersistsId() {
        RidePlaylistRiderDto a =
                new RidePlaylistRiderDto(
                        KID_A,
                        "Sam",
                        true,
                        VIEWER,
                        "stub-playlist-a",
                        "A",
                        "https://open.spotify.com/playlist/a",
                        1,
                        10,
                        List.of(
                                new com.yourorg.quickapp.playlist.RidePlaylistTrackDto(
                                        "T1", "Art", 10, "spotify:track:a1")),
                        null);
        RidePlaylistRiderDto b =
                new RidePlaylistRiderDto(
                        KID_B,
                        "Jordan",
                        true,
                        OTHER,
                        "stub-playlist-b",
                        "B",
                        "https://open.spotify.com/playlist/b",
                        1,
                        10,
                        List.of(
                                new com.yourorg.quickapp.playlist.RidePlaylistTrackDto(
                                        "T2", "Art", 10, "spotify:track:b1")),
                        null);
        when(oauthService.accessToken(VIEWER)).thenReturn(Optional.of("tok"));
        SpotifyConnectionEntity connection =
                new SpotifyConnectionEntity(
                        VIEWER,
                        "spotify-user",
                        "cipher-a",
                        "cipher-r",
                        Instant.parse("2026-09-07T20:00:00Z"),
                        Instant.parse("2026-09-07T12:00:00Z"));
        when(connectionRepository.findById(VIEWER)).thenReturn(Optional.of(connection));
        when(oauthPort.upsertMergePlaylist(
                        eq("tok"), eq("spotify-user"), eq(null), any()))
                .thenReturn(
                        new MergePlaylistResult(
                                "merge-1", "https://open.spotify.com/playlist/merge-1"));

        assertThat(api.openHandoff(VIEWER, List.of(a, b), List.of("spotify:track:remix")).url())
                .isEqualTo("https://open.spotify.com/playlist/merge-1");
        assertThat(connection.mergePlaylistId()).isEqualTo("merge-1");
        verify(connectionRepository).save(connection);
        verify(oauthPort)
                .upsertMergePlaylist(
                        "tok",
                        "spotify-user",
                        null,
                        List.of("spotify:track:remix"));
    }

    @Test
    void openHandoffZeroConnectedConflicts() {
        assertThatThrownBy(() -> api.openHandoff(VIEWER, List.of(), null))
                .isInstanceOf(PlaylistException.class)
                .hasMessageContaining("No connected playlists");
    }
}
