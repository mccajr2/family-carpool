/**
 * Pure schedule / maps / playlist-merge helpers for ride detail tabs.
 * Ported behavior-for-behavior from docs/ui-system/carpool-combined-flow.jsx
 * (~L185–256). No UI, no API calls. Mockup-shaped inputs — not OpenAPI.
 */

export type RideStop = {
  address: string
  name?: string
  kind?: string
}

export type CarpoolRouteSchedule = {
  bufferMinutes: number
  stops: RideStop[]
  legMinutes: number[]
}

export type PlaylistTrack = {
  title: string
  artist: string
  sec: number
}

export type PlaylistRider = {
  name: string
  connected: boolean
  tracks: PlaylistTrack[]
}

export type MergedTrack = PlaylistTrack & { from: string }

export type ComputedSchedule = {
  arriveBy: number
  stopTimes: number[]
}

/** Parse `h:mm AM/PM` into minutes from midnight. Assumes well-formed input. */
export function toMinutes(t: string): number {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) {
    throw new Error(`Invalid clock string: ${t}`)
  }
  const [, h, m, ap] = match
  let hours = parseInt(h!, 10) % 12
  if (ap!.toUpperCase() === "PM") hours += 12
  return hours * 60 + parseInt(m!, 10)
}

/** Format minutes-from-midnight as 12h `h:mm AM/PM`, wrapping modulo 1440. */
export function toTime(mins: number): string {
  const h24 = Math.floor((((mins % 1440) + 1440) % 1440) / 60)
  const m = ((mins % 60) + 60) % 60
  const ap = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`
}

/** Format total seconds as `m:ss`. */
export function fmtMinSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Extract the start clock from a game time range.
 * `"5:20 – 6:20 PM"` → `"5:20 PM"` (borrow AM/PM from the end when missing).
 */
export function eventStartTime(timeRange: string): string {
  const [rawStart, rawEnd = ""] = timeRange.split("–").map((s) => s.trim())
  if (/AM|PM/i.test(rawStart)) return rawStart
  const ap = (rawEnd.match(/AM|PM/i) || [""])[0]
  return `${rawStart} ${ap}`.trim()
}

/**
 * Backward-plan every stop's departure/arrival minutes from the arrival deadline.
 * Last stop = eventStart − bufferMinutes; each prior stop subtracts legMinutes[i].
 */
export function computeSchedule(
  route: CarpoolRouteSchedule,
  eventStart: string,
): ComputedSchedule {
  const arriveBy = toMinutes(eventStart) - route.bufferMinutes
  const times = new Array<number>(route.stops.length)
  times[route.stops.length - 1] = arriveBy
  for (let i = route.stops.length - 2; i >= 0; i--) {
    times[i] = times[i + 1]! - route.legMinutes[i]!
  }
  return { arriveBy, stopTimes: times }
}

function encode(addr: string): string {
  return encodeURIComponent(addr)
}

/** Google Maps Directions universal URL (no API key). */
export function navigationUrl(stops: RideStop[]): string {
  const origin = encode(stops[0]!.address)
  const destination = encode(stops[stops.length - 1]!.address)
  const waypoints = stops
    .slice(1, -1)
    .map((s) => encode(s.address))
    .join("|")
  const wp = waypoints ? `&waypoints=${waypoints}` : ""
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp}&travelmode=driving`
}

/** Embed Directions URL when `apiKey` is truthy; otherwise `null`. */
export function embedUrl(stops: RideStop[], apiKey: string | null | undefined): string | null {
  if (!apiKey) return null
  const origin = encode(stops[0]!.address)
  const destination = encode(stops[stops.length - 1]!.address)
  const waypoints = stops
    .slice(1, -1)
    .map((s) => encode(s.address))
    .join("|")
  const wp = waypoints ? `&waypoints=${waypoints}` : ""
  return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}${wp}&mode=driving`
}

/**
 * Fair round-robin merge across connected riders' playlists only.
 * Each merged track keeps `from: rider.name`. Unconnected riders contribute nothing.
 */
export function mergeTracks(riders: PlaylistRider[]): MergedTrack[] {
  const connected = riders.filter((r) => r.connected)
  const queues = connected.map((r) => [...r.tracks])
  const merged: MergedTrack[] = []
  let remaining = queues.reduce((n, q) => n + q.length, 0)
  let i = 0
  while (remaining > 0) {
    const qi = i % queues.length
    if (queues[qi]!.length > 0) {
      const track = queues[qi]!.shift()!
      merged.push({ ...track, from: connected[qi]!.name })
      remaining--
    }
    i++
  }
  return merged
}
