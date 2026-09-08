import { describe, expect, it } from "vitest"

import type { CalendarPlaylist } from "@/api/types"
import {
  driveMinutesFromRouteLegs,
  playlistRidersFromCalendarPlaylist,
} from "@/components/playlistRidersFromCalendarPlaylist"

describe("playlistRidersFromCalendarPlaylist", () => {
  it("maps connected and unconnected riders with invite contact", () => {
    const playlist: CalendarPlaylist = {
      riders: [
        {
          kidId: "k1",
          kidDisplayName: "Sam",
          connected: true,
          playlistName: "Sam gameday",
          playlistUrl: "https://open.spotify.com/playlist/a",
          trackCount: 2,
          durationSec: 400,
          tracks: [
            { title: "Sunset Drive", artist: "Coastline", durationSec: 198, uri: "spotify:track:a1" },
            { title: "Overtime", artist: "Pace Car", durationSec: 202, uri: "spotify:track:a2" },
          ],
          inviteContact: null,
        },
        {
          kidId: "k2",
          kidDisplayName: "Kwame",
          connected: false,
          tracks: [],
          inviteContact: { channel: "push", to: "the Oseis" },
        },
      ],
    }

    expect(playlistRidersFromCalendarPlaylist(playlist)).toEqual([
      {
        name: "Sam",
        connected: true,
        playlistName: "Sam gameday",
        tracks: [
          { title: "Sunset Drive", artist: "Coastline", sec: 198 },
          { title: "Overtime", artist: "Pace Car", sec: 202 },
        ],
        contact: undefined,
      },
      {
        name: "Kwame",
        connected: false,
        playlistName: undefined,
        tracks: [],
        contact: { channel: "push", to: "the Oseis" },
      },
    ])
  })
})

describe("driveMinutesFromRouteLegs", () => {
  it("sums legs and returns null for empty", () => {
    expect(driveMinutesFromRouteLegs([12, 18])).toBe(30)
    expect(driveMinutesFromRouteLegs([])).toBeNull()
    expect(driveMinutesFromRouteLegs(null)).toBeNull()
  })
})
