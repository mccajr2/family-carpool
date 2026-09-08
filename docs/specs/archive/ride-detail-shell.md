# Spec: ride-detail-shell

Status: archived  
Completed: 2026-09-07  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Updated: 2026-09-07 (`/pr`)  
Added: 2026-09-06 · enhancement  
Branch: `ride-detail-shell`  
Depends on: [`ride-detail-schedule-utils`](../archive/ride-detail-schedule-utils.md)  
Feeds: [`ride-route-tab`](../active/ride-route-tab.md) /
[`ride-playlist-tab`](../planned/ride-playlist-tab.md) /
[`ride-detail-polish`](../planned/ride-detail-polish.md)

## Problem

Once a ride is **confirmed** (household driver or teammate driving), adults
need a place to see route + playlist logistics. Calendar Agenda has no entry,
and there is no per-event detail screen with Route / Playlist tabs — so the
approved mockup flow cannot be dogfooded even with fixture data.

## Non-goals

- Real multi-stop legs from OSRM / geocoding, or persisting route on a `Ride`
  ([`ride-route-tab`](../active/ride-route-tab.md))
- Spotify OAuth, live playlists, or token storage
  ([`ride-playlist-tab`](../planned/ride-playlist-tab.md))
- Honest loading / OSRM-unreachable / notify-failure polish
  ([`ride-detail-polish`](../planned/ride-detail-polish.md))
- Real push/SMS delivery for notify or invite (UI may stub local sending
  states; delivery lands with [`push-notifications`](../planned/push-notifications.md))
- OpenAPI / backend / Expo / KMP
- Changing Calendar shell structure beyond `canRoute` entry affordances on
  Agenda list rows (no new destinations, no Focus/hero entry this PR)
- Choosing product `bufferMinutes` defaults (fixture uses mockup 45 game /
  15 practice; reconcile later via
  [`event-arrival-lead-time`](../planned/event-arrival-lead-time.md) /
  [`ride-route-tab`](../active/ride-route-tab.md))
- In-app turn-by-turn; paid live traffic; Apple Music

## Approach

Web-only port of the mockup’s **home → detail** flow, driven by **fixture**
`carpoolRoute` data. Reuse
[`rideScheduleUtils`](../../web/src/components/rideScheduleUtils.ts) for
schedule / maps URLs / merge — do not re-implement those formulas.

**Visual source of truth:**
[`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
— `canRoute`, `GameCard` route icon + expanded CTA, `DetailScreen`, `RouteTab`,
`PlaylistTab` (and supporting `RouteMap` / `StopRow` / `NotifyAction` /
`RiderTile` / `InviteAction` / `TrackRow`). Lock measured size / weight /
spacing / color into `design-tokens/tokens.json` (new or updated roles); do
not snap to a nearby existing role (`docs/ui-system.md`). Prefer existing
`heroGlow` and Agenda list tokens where the mock already matches.

**Gate (`canRoute`)** — show entry only when the ride is actually confirmed
and the kid is not marked not-going. Map mockup helpers onto live coverage /
ride join (same ideas as `AgendaRow`’s household-confirmed vs teammate-accepted
checks):

- Household confirmed driver (`isConfirmedDriver(ownRide)` and not an
  ACCEPTED teammate own-request for that kid), **or**
- Teammate driving (own request `ACCEPTED` covering that kid)
- And attendance / RSVP is not not-going

Do **not** require an API `carpoolRoute` field (none exists). Never show a
dead-end link when the gate fails.

**Fixtures** — when the user opens detail for a routable row, attach
mockup-shaped fixture route + playlist riders (game-style three-stop / 45 min
buffer vs practice-style two-stop / 15 min is fine; pick by a simple
practice/game heuristic from the calendar item, or always use the richer
fixture — document the choice in code). Later tabs replace fixtures with live
data without rewriting chrome.

**Navigation** — local overlay inside `FamilyScreen` Calendar (mockup
`nav.screen`: home ↔ detail): Back returns to Agenda; keep the existing shell
rail. No React Router / deep-link URL required this PR. Opening detail defaults
tab to **Route** and resets playlist remix seed.

**Entry points (Agenda list only, matching `GameCard`)**

1. Collapsed row: navigation affordance (icon button) when `canRoute`
2. Expanded row: full-width **Route & playlist for this ride** button when
   `canRoute`

**Detail chrome** — back control (“Back to schedule”), event date/time +
title, pill segmented **Route | Playlist** control.

**Route tab (fixture)** — leave-by hero (`computeSchedule` + `toTime`),
Start navigation (`navigationUrl`), map embed or keyless placeholder
(`embedUrl` / mockup `RouteMap`), stop-by-stop rows, notify ready-by with
**local** sending/sent UI (no network).

**Playlist tab (fixture)** — who’s in the car, invite-to-connect local stub,
merged playlist hero (`mergeTracks` + remix shuffle), Open in Spotify demo
link, Premium caveat, merge-order track list.

## Context

- Design / mockup SoT:
  [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  → `canRoute` (~L149–151); `GameCard` route affordances (~L555–612);
  `RouteMap` / `NotifyAction` / `StopRow` / `RouteTab` (~L700–880);
  `PlaylistTab` + riders/tracks (~L882–1057); `DetailScreen` (~L1060–1100);
  app nav home↔detail (~L1161–1225); fixture `carpoolRoute` shapes in
  `initialGames` (~L64–113)
- Tokens / visual lock: [`docs/ui-system.md`](../../ui-system.md) (destination
  mock → `design-tokens/tokens.json`); reuse
  [`design-tokens/tokens.json`](../../../design-tokens/tokens.json) `heroGlow`
  / list-row roles where they already match
- Foundation helpers:
  [`web/src/components/rideScheduleUtils.ts`](../../web/src/components/rideScheduleUtils.ts)
  (archived decisions:
  [`ride-detail-schedule-utils`](../archive/ride-detail-schedule-utils.md))
- Coverage / ride state for the gate:
  [`web/src/components/coverageQueue.ts`](../../web/src/components/coverageQueue.ts)
  (`isConfirmedDriver`);
  [`web/src/components/AgendaRow.tsx`](../../web/src/components/AgendaRow.tsx)
  (`isHouseholdConfirmedDriver` / `isTeammateOwnRide` patterns)
- Shell host:
  [`web/src/components/FamilyScreen.tsx`](../../web/src/components/FamilyScreen.tsx)
  (Calendar destination overlay; keep rail)
- Downstream (Problem/Notes only):
  [`ride-route-tab`](../active/ride-route-tab.md),
  [`ride-playlist-tab`](../planned/ride-playlist-tab.md)

## Acceptance criteria

- [x] Shared `canRoute` (or equivalent) is true only for confirmed household
  driver or teammate-driving rows that are not not-going; false for
  unassigned, pending household confirm, open team ask, and not-going.
- [x] Agenda collapsed row shows the route affordance only when `canRoute`;
  expanded row shows **Route & playlist for this ride** only when `canRoute`.
- [x] Activating either entry opens a detail overlay for that event with
  Route selected by default; Back returns to Agenda without leaving Calendar.
- [x] Detail shows event header + Route | Playlist segmented control; switching
  tabs preserves the open event.
- [x] Route tab renders fixture-driven leave-by hero, stop list (times from
  `computeSchedule`), Start navigation link from `navigationUrl`, and map
  placeholder when no Embed API key (or embed when a key is configured).
- [x] Playlist tab renders fixture riders, merged tracks via `mergeTracks`,
  Open in Spotify (demo URL OK), and Remix merge order (local shuffle).
- [x] Notify / invite controls update local sending/sent UI only — no API /
  push / SMS calls.
- [x] No OpenAPI, backend, or Expo changes.
- [x] New/updated visual roles from the mock are locked in
  `design-tokens/tokens.json` and consumed via generated tokens (WCAG AA is
  the only mock-hex exception).
- [x] Component/unit tests cover the gate, entry visibility, open/back, and
  tab switch; suite passes.

## Tasks

- [x] Web: extract/share `canRoute` (pure helper + tests) from mockup rules
  mapped to live `CoverageGameEvent` + `CarpoolRideEvent`
- [x] Web: Agenda list entry affordances on `AgendaRow` (collapsed icon +
  expanded CTA); wire `onOpenRide` from `FamilyScreen`
- [x] Web: `RideDetailScreen` (or equivalent) — back, header, Route/Playlist
  segmented control; Calendar overlay state in `FamilyScreen`
- [x] Web: fixture module (mockup-shaped `carpoolRoute` + playlist riders)
  attached when opening detail
- [x] Web: Route tab UI (hero, map/placeholder, stops, local notify) using
  `rideScheduleUtils`
- [x] Web: Playlist tab UI (riders, invite stub, merge hero, Open in Spotify,
  remix, track list) using `mergeTracks` / `fmtMinSec`
- [x] Tokens: lock mock size/weight/spacing/color roles needed by detail /
  route / playlist chrome; regenerate outputs
- [x] Tests: `canRoute` cases; Agenda entry show/hide; detail open/back/tab;
  Route/Playlist smoke with fixtures (helpers already covered by
  `rideScheduleUtils.test.ts`)

## Open questions

- **Focus / hero entry:** Mockup only puts route entry on list `GameCard`.
  **Proposal:** Agenda list only this PR; Focus/carousel entry can follow in
  polish or a tiny follow-up if dogfood asks for it.
- **Practice vs game fixture:** Mockup uses 15 vs 45 `bufferMinutes` and
  different stop counts. **Proposal:** choose fixture by a lightweight
  practice heuristic on the item title/opponent; if ambiguous, use the
  three-stop game fixture.
- **Maps Embed key:** **Proposal:** read optional env/config if the app
  already has a pattern; otherwise empty key → placeholder (same as mockup).
  Do not block the PR on obtaining a key.
- **URL deep links:** **Proposal:** out of scope; local overlay only until a
  later routing slice needs shareable URLs.
