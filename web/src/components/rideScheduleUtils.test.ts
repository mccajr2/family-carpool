import { describe, expect, it } from "vitest"
import {
  computeSchedule,
  embedUrl,
  eventStartTime,
  fmtMinSec,
  mergeTracks,
  navigationUrl,
  toMinutes,
  toTime,
  type CarpoolRouteSchedule,
  type PlaylistRider,
  type RideStop,
} from "./rideScheduleUtils"

/** Mockup three-stop game route (carpool-combined-flow.jsx ~L64–71). */
const threeStopRoute: CarpoolRouteSchedule = {
  bufferMinutes: 45,
  stops: [
    { name: "Home", address: "390 Huron Ave, Cambridge, MA", kind: "home" },
    {
      name: "Kwame (the Oseis)",
      address: "Somerville, MA",
      kind: "pickup",
    },
    {
      name: "Allied Veterans Rink",
      address: "65 Elm St, Everett, MA",
      kind: "destination",
    },
  ],
  legMinutes: [12, 18],
}

const twoStops: RideStop[] = [
  { address: "390 Huron Ave, Cambridge, MA" },
  { address: "65 Elm St, Everett, MA" },
]

describe("toMinutes / toTime", () => {
  it("round-trips common clock strings", () => {
    expect(toMinutes("12:40 PM")).toBe(12 * 60 + 40)
    expect(toMinutes("12:00 AM")).toBe(0)
    expect(toMinutes("12:00 PM")).toBe(12 * 60)
    expect(toTime(760)).toBe("12:40 PM")
    expect(toTime(0)).toBe("12:00 AM")
    expect(toTime(12 * 60)).toBe("12:00 PM")
  })

  it("wraps modulo 1440 for negative and past-midnight values", () => {
    expect(toTime(-5)).toBe("11:55 PM")
    expect(toTime(1440 + 65)).toBe("1:05 AM")
    expect(toTime(-1440 + 90)).toBe("1:30 AM")
  })
})

describe("fmtMinSec", () => {
  it("formats total seconds as m:ss", () => {
    expect(fmtMinSec(0)).toBe("0:00")
    expect(fmtMinSec(198)).toBe("3:18")
    expect(fmtMinSec(65)).toBe("1:05")
  })
})

describe("eventStartTime", () => {
  it("keeps AM/PM when the start already has it", () => {
    expect(eventStartTime("12:40 PM – 1:40 PM")).toBe("12:40 PM")
  })

  it("borrows AM/PM from the end when the start lacks it", () => {
    expect(eventStartTime("5:20 – 6:20 PM")).toBe("5:20 PM")
  })
})

describe("computeSchedule", () => {
  it("backward-plans the mockup three-stop fixture", () => {
    // 12:40 PM = 760; arriveBy = 760 - 45 = 715 (11:55 AM)
    // stopTimes: 715 - 18 = 697; 697 - 12 = 685 → [685, 697, 715]
    const { arriveBy, stopTimes } = computeSchedule(threeStopRoute, "12:40 PM")
    expect(arriveBy).toBe(715)
    expect(stopTimes).toEqual([685, 697, 715])
    expect(toTime(arriveBy)).toBe("11:55 AM")
    expect(stopTimes.map(toTime)).toEqual(["11:25 AM", "11:37 AM", "11:55 AM"])
  })
})

describe("navigationUrl", () => {
  it("encodes origin, destination, and |joined mid waypoints for ≥3 stops", () => {
    const url = navigationUrl(threeStopRoute.stops)
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1" +
        `&origin=${encodeURIComponent("390 Huron Ave, Cambridge, MA")}` +
        `&destination=${encodeURIComponent("65 Elm St, Everett, MA")}` +
        `&waypoints=${encodeURIComponent("Somerville, MA")}` +
        "&travelmode=driving",
    )
  })

  it("omits waypoints for two-stop routes", () => {
    const url = navigationUrl(twoStops)
    expect(url).not.toContain("waypoints")
    expect(url).toContain(
      `origin=${encodeURIComponent("390 Huron Ave, Cambridge, MA")}`,
    )
    expect(url).toContain(
      `destination=${encodeURIComponent("65 Elm St, Everett, MA")}`,
    )
    expect(url).toContain("travelmode=driving")
  })
})

describe("embedUrl", () => {
  it("returns null without an API key", () => {
    expect(embedUrl(threeStopRoute.stops, null)).toBeNull()
    expect(embedUrl(threeStopRoute.stops, undefined)).toBeNull()
    expect(embedUrl(threeStopRoute.stops, "")).toBeNull()
  })

  it("returns a keyed Embed Directions URL when a key is provided", () => {
    const url = embedUrl(threeStopRoute.stops, "test-key")
    expect(url).toBe(
      "https://www.google.com/maps/embed/v1/directions?key=test-key" +
        `&origin=${encodeURIComponent("390 Huron Ave, Cambridge, MA")}` +
        `&destination=${encodeURIComponent("65 Elm St, Everett, MA")}` +
        `&waypoints=${encodeURIComponent("Somerville, MA")}` +
        "&mode=driving",
    )
  })
})

describe("mergeTracks", () => {
  const declanTracks = [
    { title: "Sunset Drive", artist: "Coastline", sec: 198 },
    { title: "Neon Static", artist: "Halfway House", sec: 221 },
  ]
  const mayaTracks = [
    { title: "Overtime", artist: "Pace Car", sec: 176 },
    { title: "Rink Lights", artist: "Coastline", sec: 204 },
  ]

  it("round-robins only connected riders and tags from", () => {
    const riders: PlaylistRider[] = [
      { name: "Declan", connected: true, tracks: declanTracks },
      { name: "Kwame", connected: false, tracks: mayaTracks },
      { name: "Maya", connected: true, tracks: mayaTracks },
    ]
    expect(mergeTracks(riders)).toEqual([
      { ...declanTracks[0], from: "Declan" },
      { ...mayaTracks[0], from: "Maya" },
      { ...declanTracks[1], from: "Declan" },
      { ...mayaTracks[1], from: "Maya" },
    ])
  })

  it("returns empty when no riders are connected", () => {
    expect(
      mergeTracks([
        { name: "Kwame", connected: false, tracks: declanTracks },
      ]),
    ).toEqual([])
  })
})
