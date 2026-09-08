/**
 * Mockup-shaped carpoolRoute + playlist fixtures for ride detail.
 * Ported from docs/ui-system/carpool-combined-flow.jsx initialGames (~L64–115).
 * Later route/playlist slices replace fixtures with live data without rewriting chrome.
 *
 * Practice vs game: lightweight `\bpractice\b` title heuristic; ambiguous → game
 * (three-stop / 45 min buffer). See ride-detail-shell open questions.
 */

import type { CalendarItem } from "@/api/types"
import type {
  CarpoolRouteSchedule,
  PlaylistRider,
  PlaylistTrack,
  RideStop,
} from "@/components/rideScheduleUtils"

export type RideNotifyContact = {
  channel: "push" | "sms"
  to: string
}

export type FixtureRideStop = RideStop & {
  name: string
  kind: "home" | "pickup" | "destination"
  contact?: RideNotifyContact
}

export type FixturePlaylistRider = PlaylistRider & {
  playlistName?: string
  contact?: RideNotifyContact
}

export type FixtureCarpoolRoute = Omit<CarpoolRouteSchedule, "stops"> & {
  /** Which mockup seed was chosen — game = 45 min / 3 stops; practice = 15 / 2. */
  kind: "game" | "practice"
  stops: FixtureRideStop[]
  playlistRiders: FixturePlaylistRider[]
}

const DECLAN_WARMUP_TRACKS: PlaylistTrack[] = [
  { title: "Sunset Drive", artist: "Coastline", sec: 198 },
  { title: "Neon Static", artist: "Halfway House", sec: 221 },
  { title: "Overtime", artist: "Pace Car", sec: 176 },
  { title: "Rink Lights", artist: "Coastline", sec: 204 },
]

/** Three-stop game fixture (45 min buffer) — mockup game id 3. */
export const GAME_CARPOOL_ROUTE_FIXTURE: FixtureCarpoolRoute = {
  kind: "game",
  bufferMinutes: 45,
  stops: [
    { name: "Home", address: "390 Huron Ave, Cambridge, MA", kind: "home" },
    {
      name: "Kwame (the Oseis)",
      address: "Somerville, MA",
      kind: "pickup",
      contact: { channel: "push", to: "the Oseis" },
    },
    {
      name: "Allied Veterans Rink",
      address: "65 Elm St, Everett, MA",
      kind: "destination",
    },
  ],
  legMinutes: [12, 18],
  playlistRiders: [
    {
      name: "Declan",
      connected: true,
      playlistName: "Declan's Warmup Mix",
      tracks: [...DECLAN_WARMUP_TRACKS],
    },
    {
      name: "Kwame",
      connected: false,
      tracks: [],
      contact: { channel: "push", to: "the Oseis" },
    },
  ],
}

/** Two-stop practice fixture (15 min buffer) — mockup practice id 5. */
export const PRACTICE_CARPOOL_ROUTE_FIXTURE: FixtureCarpoolRoute = {
  kind: "practice",
  bufferMinutes: 15,
  stops: [
    { name: "Home", address: "390 Huron Ave, Cambridge, MA", kind: "home" },
    {
      name: "Allied Veterans Rink",
      address: "65 Elm St, Everett, MA",
      kind: "destination",
    },
  ],
  legMinutes: [14],
  playlistRiders: [
    {
      name: "Declan",
      connected: true,
      playlistName: "Declan's Warmup Mix",
      tracks: DECLAN_WARMUP_TRACKS.slice(0, 3),
    },
  ],
}

/** True when the calendar title looks like a practice (word boundary). */
export function isPracticeEventTitle(title: string): boolean {
  return /\bpractice\b/i.test(title.trim())
}

/**
 * Pick mockup fixture for a calendar item. Practice heuristic on title;
 * otherwise the richer three-stop game fixture.
 */
export function carpoolRouteFixtureForCalendarItem(
  item: Pick<CalendarItem, "title">,
): FixtureCarpoolRoute {
  return isPracticeEventTitle(item.title)
    ? PRACTICE_CARPOOL_ROUTE_FIXTURE
    : GAME_CARPOOL_ROUTE_FIXTURE
}
