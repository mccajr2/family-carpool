/**
 * Parked Spotify playlist / OAuth return helpers (Carpool music parking lot).
 * Excluded from default `npm test`; run via `npm run test:parked`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import type { CalendarPlaylist } from "@/api/types"
import {
  driveMinutesFromRouteLegs,
  playlistRidersFromCalendarPlaylist,
} from "@/components/playlistRidersFromCalendarPlaylist"
import {
  SPOTIFY_OAUTH_RETURN_KEY,
  consumeSpotifyConnectedQuery,
  saveSpotifyOAuthReturn,
  takeSpotifyOAuthReturn,
} from "@/components/spotifyOAuthReturn"

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
        kidId: "k1",
        name: "Sam",
        connected: true,
        playlistName: "Sam gameday",
        designatingAdultId: null,
        viewerCanManage: false,
        tracks: [
          { title: "Sunset Drive", artist: "Coastline", sec: 198, uri: "spotify:track:a1" },
          { title: "Overtime", artist: "Pace Car", sec: 202, uri: "spotify:track:a2" },
        ],
        contact: undefined,
      },
      {
        kidId: "k2",
        name: "Kwame",
        connected: false,
        playlistName: undefined,
        designatingAdultId: null,
        viewerCanManage: false,
        tracks: [],
        contact: { channel: "push", to: "the Oseis" },
      },
    ])
  })

  it("marks circle kids as viewer-manageable", () => {
    const playlist: CalendarPlaylist = {
      riders: [
        {
          kidId: "k1",
          kidDisplayName: "Sam",
          connected: false,
          tracks: [],
          inviteContact: { channel: "push", to: "Alex" },
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

    const riders = playlistRidersFromCalendarPlaylist(playlist, {
      circleKidIds: ["k1"],
    })
    expect(riders[0]?.viewerCanManage).toBe(true)
    expect(riders[1]?.viewerCanManage).toBe(false)
  })
})

describe("driveMinutesFromRouteLegs", () => {
  it("sums legs and returns null for empty", () => {
    expect(driveMinutesFromRouteLegs([12, 18])).toBe(30)
    expect(driveMinutesFromRouteLegs([])).toBeNull()
    expect(driveMinutesFromRouteLegs(null)).toBeNull()
  })
})

describe("spotifyOAuthReturn", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it("round-trips oauth return context", () => {
    saveSpotifyOAuthReturn({
      rideDetailItemKey: "MANUAL:e1",
      designateKidId: "k1",
    })
    expect(sessionStorage.getItem(SPOTIFY_OAUTH_RETURN_KEY)).not.toBeNull()
    expect(takeSpotifyOAuthReturn()).toEqual({
      rideDetailItemKey: "MANUAL:e1",
      designateKidId: "k1",
    })
    expect(takeSpotifyOAuthReturn()).toBeNull()
  })

  it("consumes spotify=connected query and cleans the URL", () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {})
    expect(consumeSpotifyConnectedQuery("?spotify=connected&x=1")).toBe(true)
    expect(replaceState).toHaveBeenCalled()
    const path = String(replaceState.mock.calls[0]?.[2] ?? "")
    expect(path).not.toContain("spotify=")
    expect(path).toContain("x=1")
    expect(consumeSpotifyConnectedQuery("?other=1")).toBe(false)
    replaceState.mockRestore()
  })
})
