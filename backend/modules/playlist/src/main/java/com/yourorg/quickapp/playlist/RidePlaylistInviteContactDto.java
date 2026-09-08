package com.yourorg.quickapp.playlist;

/** Soft-fail invite target for an unconnected kid tile (push/SMS later). */
public record RidePlaylistInviteContactDto(String channel, String to) {}
