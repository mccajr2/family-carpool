package com.yourorg.quickapp.playlist.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.playlist.RidePlaylistRiderDto;
import com.yourorg.quickapp.playlist.RidePlaylistTrackDto;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TrackMergeTest {

    @Test
    void roundRobinsConnectedRiders() {
        RidePlaylistRiderDto a =
                rider(
                        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                        "Sam",
                        List.of(track("A1", "spotify:track:a1"), track("A2", "spotify:track:a2")));
        RidePlaylistRiderDto b =
                rider(
                        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                        "Jordan",
                        List.of(track("B1", "spotify:track:b1")));
        RidePlaylistRiderDto disconnected =
                new RidePlaylistRiderDto(
                        UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                        "Other",
                        false,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        List.of(track("X", "spotify:track:x")),
                        null);

        List<RidePlaylistTrackDto> merged =
                TrackMerge.mergeConnected(List.of(a, disconnected, b));

        assertThat(merged.stream().map(RidePlaylistTrackDto::title).toList())
                .containsExactly("A1", "B1", "A2");
        assertThat(TrackMerge.urisOf(merged))
                .containsExactly("spotify:track:a1", "spotify:track:b1", "spotify:track:a2");
    }

    private static RidePlaylistRiderDto rider(
            String kidId, String name, List<RidePlaylistTrackDto> tracks) {
        return new RidePlaylistRiderDto(
                UUID.fromString(kidId),
                name,
                true,
                UUID.randomUUID(),
                "pl",
                "Mix",
                "https://open.spotify.com/playlist/pl",
                tracks.size(),
                tracks.stream().mapToInt(RidePlaylistTrackDto::durationSec).sum(),
                tracks,
                null);
    }

    private static RidePlaylistTrackDto track(String title, String uri) {
        return new RidePlaylistTrackDto(title, "Artist", 100, uri);
    }
}
