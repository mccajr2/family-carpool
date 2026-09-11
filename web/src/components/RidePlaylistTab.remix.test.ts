import { describe, expect, it } from "vitest"

import type { FixturePlaylistRider } from "@/components/rideDetailFixtures"
import { remixMergedTracks, remixedTrackUris } from "@/components/RidePlaylistTab"
import { mergeTracks } from "@/components/rideScheduleUtils"

/** Pure remix helpers stay in the default suite; Spotify UI chrome is parked. */
const TWO_CONNECTED_RIDERS: FixturePlaylistRider[] = [
  {
    kidId: "k-declan",
    name: "Declan",
    connected: true,
    playlistName: "Declan's Warmup Mix",
    tracks: [
      { title: "Sunset Drive", artist: "Coastline", sec: 198, uri: "spotify:track:d1" },
      { title: "Overtime", artist: "Pace Car", sec: 176, uri: "spotify:track:d2" },
    ],
  },
  {
    kidId: "k-kwame",
    name: "Kwame",
    connected: true,
    playlistName: "Kwame picks",
    tracks: [
      { title: "Neon Static", artist: "Halfway House", sec: 221, uri: "spotify:track:k1" },
      { title: "Rink Lights", artist: "Coastline", sec: 204, uri: "spotify:track:k2" },
    ],
  },
]

describe("remixMergedTracks", () => {
  it("leaves fair merge order alone at seed 0 and reshuffles for later seeds", () => {
    const base = mergeTracks(TWO_CONNECTED_RIDERS)
    expect(remixMergedTracks(base, 0)).toEqual(base)
    const remixed = remixMergedTracks(base, 1)
    expect(remixed).toHaveLength(base.length)
    expect(remixed.map((t) => t.title).sort()).toEqual(base.map((t) => t.title).sort())
    expect(remixed).not.toEqual(base)
  })

  it("collects remixed Spotify URIs in order", () => {
    const remixed = remixMergedTracks(mergeTracks(TWO_CONNECTED_RIDERS), 1)
    expect(remixedTrackUris(remixed)).toEqual(
      remixed.map((track) => track.uri).filter(Boolean),
    )
  })
})
