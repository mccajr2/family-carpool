package com.yourorg.quickapp.playlist.internal;

import com.yourorg.quickapp.playlist.RidePlaylistRiderDto;
import com.yourorg.quickapp.playlist.RidePlaylistTrackDto;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

/**
 * Fair round-robin merge of connected riders' tracks — same algorithm as web
 * {@code mergeTracks}.
 */
final class TrackMerge {

    private TrackMerge() {}

    static List<RidePlaylistTrackDto> mergeConnected(List<RidePlaylistRiderDto> riders) {
        List<RidePlaylistRiderDto> connected =
                riders.stream().filter(RidePlaylistRiderDto::connected).toList();
        if (connected.isEmpty()) {
            return List.of();
        }
        List<LinkedList<RidePlaylistTrackDto>> queues = new ArrayList<>(connected.size());
        int remaining = 0;
        for (RidePlaylistRiderDto rider : connected) {
            LinkedList<RidePlaylistTrackDto> q = new LinkedList<>(rider.tracks());
            queues.add(q);
            remaining += q.size();
        }
        List<RidePlaylistTrackDto> merged = new ArrayList<>(remaining);
        int i = 0;
        while (remaining > 0) {
            int qi = i % queues.size();
            LinkedList<RidePlaylistTrackDto> q = queues.get(qi);
            if (!q.isEmpty()) {
                merged.add(q.removeFirst());
                remaining--;
            }
            i++;
        }
        return merged;
    }

    static List<String> urisOf(List<RidePlaylistTrackDto> tracks) {
        return tracks.stream()
                .map(RidePlaylistTrackDto::uri)
                .filter(u -> u != null && !u.isBlank())
                .toList();
    }
}
