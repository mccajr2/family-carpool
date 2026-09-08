/**
 * Map GET …/calendar/{source}/{itemId}/playlist into RidePlaylistTab riders.
 */

import type { CalendarPlaylist } from "@/api/types"
import type { FixturePlaylistRider } from "@/components/rideDetailFixtures"

export type PlaylistRidersMapOptions = {
  /** Circle kid ids for the viewing adult — enables connect/designate on those tiles. */
  circleKidIds?: ReadonlySet<string> | readonly string[]
}

export function playlistRidersFromCalendarPlaylist(
  playlist: CalendarPlaylist,
  options: PlaylistRidersMapOptions = {},
): FixturePlaylistRider[] {
  const circleKids =
    options.circleKidIds == null
      ? null
      : options.circleKidIds instanceof Set
        ? options.circleKidIds
        : new Set(options.circleKidIds)

  return playlist.riders.map((rider) => ({
    kidId: rider.kidId,
    name: rider.kidDisplayName,
    connected: rider.connected,
    playlistName: rider.playlistName ?? undefined,
    designatingAdultId: rider.designatingAdultId ?? null,
    viewerCanManage: circleKids?.has(rider.kidId) ?? false,
    tracks: rider.tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      sec: track.durationSec,
      ...(track.uri ? { uri: track.uri } : {}),
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
