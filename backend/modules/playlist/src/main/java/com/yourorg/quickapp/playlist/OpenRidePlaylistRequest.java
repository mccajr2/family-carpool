package com.yourorg.quickapp.playlist;

import java.util.List;

/**
 * Optional remixed track URI order from the client. When empty/omitted and 2+
 * connected playlists, the server applies fair round-robin merge.
 */
public record OpenRidePlaylistRequest(List<String> trackUris) {}
