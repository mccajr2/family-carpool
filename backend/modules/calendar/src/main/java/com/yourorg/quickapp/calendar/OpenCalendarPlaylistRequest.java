package com.yourorg.quickapp.calendar;

import java.util.List;

/** Optional remixed Spotify track URI order for 2+ open handoff. */
public record OpenCalendarPlaylistRequest(List<String> trackUris) {}
