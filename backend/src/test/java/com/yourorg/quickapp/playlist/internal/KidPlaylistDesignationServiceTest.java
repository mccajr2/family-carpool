package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.playlist.KidPlaylistDesignationResponse;
import com.yourorg.quickapp.playlist.SpotifyPlaylistOptionResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class KidPlaylistDesignationServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-07T15:00:00Z");
    private static final UUID ADULT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID CIRCLE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID KID_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");

    @Mock
    private FamilyMembershipApi membershipApi;

    @Mock
    private SpotifyOAuthService oauthService;

    @Mock
    private SpotifyOAuthPort oauthPort;

    @Mock
    private SpotifyKidDesignationRepository designationRepository;

    private KidPlaylistDesignationService service;

    @BeforeEach
    void setUp() {
        service =
                new KidPlaylistDesignationService(
                        membershipApi,
                        oauthService,
                        oauthPort,
                        designationRepository,
                        Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void listSpotifyPlaylistsRequiresConnection() {
        when(oauthService.accessToken(ADULT_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.listSpotifyPlaylists(ADULT_ID))
                .isInstanceOf(PlaylistException.class)
                .extracting(ex -> ((PlaylistException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void listSpotifyPlaylistsMapsCatalog() {
        when(oauthService.accessToken(ADULT_ID)).thenReturn(Optional.of("tok"));
        when(oauthPort.listPlaylists("tok"))
                .thenReturn(
                        List.of(
                                new SpotifyPlaylistInfo(
                                        "p1", "Mix", "https://open.spotify.com/playlist/p1", 3)));

        List<SpotifyPlaylistOptionResponse> options = service.listSpotifyPlaylists(ADULT_ID);

        assertThat(options).hasSize(1);
        assertThat(options.getFirst().id()).isEqualTo("p1");
        assertThat(options.getFirst().name()).isEqualTo("Mix");
        assertThat(options.getFirst().trackCount()).isEqualTo(3);
    }

    @Test
    void setDesignationUpsertsAndValidatesKid() {
        when(membershipApi.requireMemberCircleId(ADULT_ID)).thenReturn(CIRCLE_ID);
        when(oauthService.accessToken(ADULT_ID)).thenReturn(Optional.of("tok"));
        when(oauthPort.getPlaylist("tok", "stub-playlist-a"))
                .thenReturn(StubSpotifyOAuthPort.PLAYLIST_A);
        when(designationRepository.findByAdultIdAndKidId(ADULT_ID, KID_ID))
                .thenReturn(Optional.empty());
        when(membershipApi.findKids(CIRCLE_ID, List.of(KID_ID)))
                .thenReturn(List.of(new FamilyKidName(KID_ID, "Sam")));

        KidPlaylistDesignationResponse response =
                service.setDesignation(ADULT_ID, KID_ID, "stub-playlist-a");

        verify(membershipApi).requireKidsInCircle(CIRCLE_ID, List.of(KID_ID));
        ArgumentCaptor<SpotifyKidDesignationEntity> captor =
                ArgumentCaptor.forClass(SpotifyKidDesignationEntity.class);
        verify(designationRepository).save(captor.capture());
        assertThat(captor.getValue().spotifyPlaylistId()).isEqualTo("stub-playlist-a");
        assertThat(captor.getValue().playlistName()).isEqualTo("Sam gameday");
        assertThat(response.kidDisplayName()).isEqualTo("Sam");
        assertThat(response.trackCount()).isEqualTo(12);
    }

    @Test
    void setDesignationChangesExisting() {
        when(membershipApi.requireMemberCircleId(ADULT_ID)).thenReturn(CIRCLE_ID);
        when(oauthService.accessToken(ADULT_ID)).thenReturn(Optional.of("tok"));
        when(oauthPort.getPlaylist("tok", "stub-playlist-b"))
                .thenReturn(StubSpotifyOAuthPort.PLAYLIST_B);
        SpotifyKidDesignationEntity existing =
                new SpotifyKidDesignationEntity(
                        ADULT_ID,
                        KID_ID,
                        "stub-playlist-a",
                        "Sam gameday",
                        "https://open.spotify.com/playlist/stub-playlist-a",
                        12,
                        NOW.minusSeconds(60));
        when(designationRepository.findByAdultIdAndKidId(ADULT_ID, KID_ID))
                .thenReturn(Optional.of(existing));
        when(membershipApi.findKids(CIRCLE_ID, List.of(KID_ID)))
                .thenReturn(List.of(new FamilyKidName(KID_ID, "Sam")));

        KidPlaylistDesignationResponse response =
                service.setDesignation(ADULT_ID, KID_ID, "stub-playlist-b");

        assertThat(response.spotifyPlaylistId()).isEqualTo("stub-playlist-b");
        assertThat(response.playlistName()).isEqualTo("Jordan warmup");
        assertThat(existing.spotifyPlaylistId()).isEqualTo("stub-playlist-b");
        verify(designationRepository).save(existing);
    }

    @Test
    void listDesignationsSkipsKidsNoLongerInCircle() {
        when(membershipApi.requireMemberCircleId(ADULT_ID)).thenReturn(CIRCLE_ID);
        SpotifyKidDesignationEntity row =
                new SpotifyKidDesignationEntity(
                        ADULT_ID,
                        KID_ID,
                        "stub-playlist-a",
                        "Sam gameday",
                        "https://open.spotify.com/playlist/stub-playlist-a",
                        12,
                        NOW);
        when(designationRepository.findByAdultIdOrderByUpdatedAtDesc(ADULT_ID))
                .thenReturn(List.of(row));
        when(membershipApi.findKids(eq(CIRCLE_ID), any())).thenReturn(List.of());

        assertThat(service.listDesignations(ADULT_ID)).isEmpty();
        verify(designationRepository, never()).delete(any());
    }

    @Test
    void clearDesignationDeletesRow() {
        when(membershipApi.requireMemberCircleId(ADULT_ID)).thenReturn(CIRCLE_ID);
        service.clearDesignation(ADULT_ID, KID_ID);
        verify(membershipApi).requireKidsInCircle(CIRCLE_ID, List.of(KID_ID));
        verify(designationRepository).deleteByAdultIdAndKidId(ADULT_ID, KID_ID);
    }
}
