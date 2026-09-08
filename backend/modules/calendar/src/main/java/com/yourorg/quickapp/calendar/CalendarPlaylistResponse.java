package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.playlist.RidePlaylistRiderDto;
import java.util.List;

/** Confirmed-ride Playlist tab payload: one rider tile per attending kid. */
public record CalendarPlaylistResponse(List<RidePlaylistRiderDto> riders) {}
