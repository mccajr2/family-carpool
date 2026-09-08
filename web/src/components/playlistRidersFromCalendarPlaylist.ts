/**
 * Map GET …/calendar/{source}/{itemId}/playlist into RidePlaylistTab riders.
 */

import type { CalendarPlaylist } from "@/api/types"
import type { FixturePlaylistRider } from "@/components/rideDetailFixtures"

export function playlistRidersFromCalendarPlaylist(
  playlist: CalendarPlaylist,
): FixturePlaylistRider[] {
  return playlist.riders.map((rider) => ({
    name: rider.kidDisplayName,
    connected: rider.connected,
    playlistName: rider.playlistName ?? undefined,
    tracks: rider.tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      sec: track.durationSec,
    })),
    contact: rider.inviteContact
      ? { channel: rider.inviteContact.channel, to: rider.inviteContact.to }
      : undefined,
  }))
}

/** Sum of OK route legs; null when Route is UNAVAILABLE or missing. */
export function driveMinutesFromRouteLegs(
  legMinutes: number[] | null | undefined,
): number | null {
  if (legMinutes == null || legMinutes.length === 0) {
    return null
  }
  return legMinutes.reduce((a, b) => a + b, 0)
}
