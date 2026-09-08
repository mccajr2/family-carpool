# Spec: ride-detail-schedule-utils

Status: archived  
Completed: 2026-09-06  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Updated: 2026-09-06 (`/pr`)  
Added: 2026-09-06 · enhancement  
Branch: `ride-detail-schedule-utils`  
Feeds: [`ride-detail-shell`](ride-detail-shell.md) →
[`ride-route-tab`](../archive/ride-route-tab.md) /
[`ride-playlist-tab`](../active/ride-playlist-tab.md)

## Problem

The approved Route/Playlist mockup embeds pure time-math, track-merge, and maps
URL helpers that every later detail slice needs. Leaving them inside the JSX
mock (or re-deriving them per tab) risks divergent leave-by math and playlist
merge rules. Extract them first so schedule and Spotify merge logic are
unit-tested without UI risk — same foundation pattern as
[`coverage-priority-engine`](../archive/coverage-priority-engine.md).

## Non-goals

- Detail screen UI, Agenda/`canRoute` entry points, or Route/Playlist chrome
  ([`ride-detail-shell`](ride-detail-shell.md) and later)
- OSRM / geocoding / live `legMinutes` computation
  ([`ride-route-tab`](../archive/ride-route-tab.md))
- Spotify OAuth, API calls, or token storage
  ([`ride-playlist-tab`](../active/ride-playlist-tab.md))
- Persist `Ride` or playlist records; OpenAPI / backend changes
- Choosing `bufferMinutes` product defaults (mockup 45 game / 15 practice vs
  Agenda sketch) — deferred to
  [`event-arrival-lead-time`](../planned/event-arrival-lead-time.md) /
  [`ride-route-tab`](../archive/ride-route-tab.md); this slice only consumes a
  numeric `bufferMinutes`
- Apple Music / multi-service catalogs; in-app turn-by-turn
- Wiring helpers into live Calendar/Agenda surfaces

## Approach

Add a **pure TypeScript module** under `web/src/components/` (suggested name
`rideScheduleUtils.ts`, colocated like `coverageQueue.ts`) that ports the
mockup helpers **behavior-for-behavior** from
[`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
(lines ~185–256):

1. **Clock helpers** — `toMinutes(t)`, `toTime(mins)` (12h `h:mm AM/PM`, wrap
   modulo 1440).
2. **Display helpers** — `fmtMinSec(totalSec)` (`m:ss`); `eventStartTime` from a
   range string (`"5:20 – 6:20 PM"` → `"5:20 PM"`, borrowing AM/PM from the end
   when the start lacks it).
3. **`computeSchedule(route, eventStart)`** — backward-plan stop times:
   `arriveBy = toMinutes(eventStart) - bufferMinutes`; last stop = `arriveBy`;
   each prior stop subtracts `legMinutes[i]`. Returns `{ arriveBy, stopTimes }`.
4. **Maps URLs** — `navigationUrl(stops)` → Google Maps Directions universal URL
   (`api=1`, `travelmode=driving`, encoded origin / destination / `|`-joined
   waypoints). `embedUrl(stops, apiKey)` → Embed Directions URL when `apiKey` is
   truthy, else `null` (no key → placeholder later; not this PR).
5. **`mergeTracks(riders)`** — fair round-robin across **connected** riders only;
   each merged track keeps source metadata (`from: rider.name`). Unconnected
   riders contribute nothing.

Minimal input types in the same module (mockup-shaped, not OpenAPI): e.g. stop
`{ address: string; … }`, route `{ bufferMinutes; stops; legMinutes }`, rider
`{ name; connected; tracks: { title; artist; sec; … }[] }`. Downstream slices
map real data onto these shapes.

**No UI. No OpenAPI.** Callers in later ranks import the shared module; do not
re-implement these formulas in components.

## Context

- Design / mockup SoT: [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  → helpers block `toMinutes` / `toTime` / `fmtMinSec` / `eventStartTime` /
  `computeSchedule` / `navigationUrl` / `embedUrl` / `mergeTracks` (~L185–256);
  fixture `carpoolRoute` shapes in `initialGames` (~L64–104)
- Precedent (foundation module, no UI):
  [`coverage-priority-engine`](../archive/coverage-priority-engine.md) →
  `web/src/components/coverageQueue.ts`
- Downstream stubs (read Problem/Notes only if needed for type naming):
  [`ride-detail-shell`](ride-detail-shell.md),
  [`ride-route-tab`](../archive/ride-route-tab.md),
  [`ride-playlist-tab`](../active/ride-playlist-tab.md)

## Acceptance criteria

- [x] Pure module exports `toMinutes`, `toTime`, `fmtMinSec`, `eventStartTime`,
  `computeSchedule`, `navigationUrl`, `embedUrl`, and `mergeTracks` (names may
  be camelCase TypeScript idioms; behavior matches the mockup).
- [x] `computeSchedule` on the mockup three-stop fixture (`bufferMinutes: 45`,
  `legMinutes: [12, 18]`, event start `"12:40 PM"`) yields `arriveBy` and
  `stopTimes` matching hand calculation from the mockup formulas.
- [x] `navigationUrl` builds a Directions URL with encoded origin, destination,
  and `|`-joined mid waypoints when ≥3 stops; two-stop routes omit the
  `waypoints` param.
- [x] `embedUrl` returns `null` without an API key and a keyed Embed Directions
  URL when a key is provided.
- [x] `mergeTracks` round-robins only `connected: true` riders; empty when none
  connected; each merged item includes `from` = contributing rider name.
- [x] `eventStartTime` covers: start already has AM/PM; start borrows AM/PM from
  end (`"5:20 – 6:20 PM"` → `"5:20 PM"`).
- [x] No React components, screens, Agenda wiring, backend, or OpenAPI changes
  in this PR.
- [x] Unit tests colocated with the module; suite passes.

## Tasks

- [x] Web: add `web/src/components/rideScheduleUtils.ts` (or agreed name) with
  types + helpers ported from the mockup
- [x] Tests: `rideScheduleUtils.test.ts` covering clock wrap, schedule fixture,
  maps URL encoding/waypoints/`embedUrl` null, merge round-robin + disconnected
  skip, `eventStartTime` / `fmtMinSec` cases above
- [x] Docs: none beyond this spec (mockup remains SoT until tabs land)

## Open questions

- **Module name:** `rideScheduleUtils` vs split `rideSchedule` + `ridePlaylistMerge`
  — **Proposal:** one module (mockup co-locates them; one import for all later
  tabs). Split only if the file grows past ~200 lines of logic.
- **Malformed clock strings:** mockup assumes well-formed `h:mm AM/PM`.
  **Proposal:** happy-path only in v1; do not invent silent fallbacks — tests
  use valid fixtures; later UI validates before call.
- **`bufferMinutes` defaults:** out of scope here; callers pass the number.
