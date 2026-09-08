# Spec: ride-route-tab

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Updated: 2026-09-07 (`/spec`)  
Added: 2026-09-06 · enhancement  
Branch: `ride-route-tab`  
Depends on: [`ride-detail-shell`](../archive/ride-detail-shell.md) (chrome +
fixture Route UI), [`ride-detail-schedule-utils`](../archive/ride-detail-schedule-utils.md)
(client schedule / maps math)  
Feeds: [`ride-playlist-tab`](../planned/ride-playlist-tab.md),
[`ride-detail-polish`](../planned/ride-detail-polish.md),
[`event-arrival-lead-time`](../planned/event-arrival-lead-time.md),
[`push-notifications`](../planned/push-notifications.md)

## Problem

Confirmed rides open a Route tab that is still **fixture data**. Adults cannot
see real ordered stops (driver leave-from → teammate pickups → venue), routed
`legMinutes`, or a leave-by that includes pickup legs. Agenda leave-by remains
single-origin; accepted pickups are invisible in the driver’s schedule.

## Non-goals

- In-app turn-by-turn (Google Maps universal deep link via existing
  `navigationUrl` only)
- Google Directions API as primary routing (OSRM first; free-tier / PoC)
- Spotify / playlist live data ([`ride-playlist-tab`](../planned/ride-playlist-tab.md))
- Rich loading / OSRM-unreachable / notify-failure chrome
  ([`ride-detail-polish`](../planned/ride-detail-polish.md)) — this PR needs
  only a **minimal honest** unavailable state (no silent fixture leave-by when
  live routing failed)
- Real push / SMS delivery ([`push-notifications`](../planned/push-notifications.md))
- Editable arrival lead times
  ([`event-arrival-lead-time`](../planned/event-arrival-lead-time.md))
- Changing carpool accept rules (still one ACCEPTED ride per vehicle + event;
  multi-family merge onto one vehicle remains a later product change)
- Per-event leave-from override for route origin (same as detour: adult default
  leave-from → first located place) — coverage-scoped leave-from is
  [`coverage-leave-from`](../planned/coverage-leave-from.md)
- Expo / KMP / paid live traffic
- Rewriting Route visual chrome already shipped in the shell (tokens already
  locked unless a live-data edge forces a new role)

## Approach

Replace fixture `carpoolRoute` on the Route tab with a **server-owned** multi-stop
itinerary for a confirmed ride. Reuse leaveby pairwise OSRM + Nominatim +
`leaveby_route_cache` (same stack as
[`carpool-pickup-detour`](../archive/carpool-pickup-detour.md)); do not invent a
second duration cache with divergent numbers.

**Stop order:** driving adult’s default leave-from (home) → pickup stop(s) from
`ACCEPTED` teammate request(s) this driver is fulfilling for the event (pickup
snapshot address / place) → event destination (geocoded `location`). With
current accept rules, pickups are typically 0–1; the DTO must still be an
ordered list.

**Buffer (locked until editable lead times):** classify from calendar title
heuristic already used by fixtures (`\bpractice\b` → practice; else if the item
looks like a game/match use game; otherwise other):

| Kind | `bufferMinutes` |
| ---- | --------------- |
| game | **45** |
| practice | **20** |
| other / manual / ambiguous non-game | **0** |

Do **not** ship mockup practice **15** or the lead-time sketch **30/15/0** in
this PR. Agenda single-origin leave-by stays on its existing fixed buffer until
`event-arrival-lead-time` reconciles both surfaces.

**Cache-on-confirm (not live traffic):** OSRM is static road-network duration
(product copy: **estimate**). Persist ordered stops + `legMinutes` + buffer + a
**stop fingerprint** (normalized addresses / coords) when a ride becomes
routable:

- Teammate: `acceptCarpoolRide` → `ACCEPTED`
- Household: coverage self-assign → `CONFIRMED`, or assignee `confirm`

**Invalidate / recompute** when the fingerprint would change: withdraw / cancel
accepted ride, coverage remove that ends confirmed driving, leave-from default
change for the driver, place lat/lng update, or pickup snapshot / destination
string change. On GET, if fingerprint mismatches stored route, recompute and
replace. Do **not** recompute on every visit when the fingerprint still matches.

**Contract (OpenAPI — required):** add a read that returns the itinerary for a
calendar item the caller may route (same gate ideas as web `canRoute`: confirmed
household driver or riding-with / driving via accepted teammate, not not-going).
Shape mirrors the mockup / `FixtureCarpoolRoute` schedule fields (without
playlist riders):

- `status`: `OK` | `UNAVAILABLE` (optional `reason`)
- `bufferMinutes`
- `stops[]`: `name`, `address`, `kind` (`home` | `pickup` | `destination`),
  optional notify contact stub fields if useful for UI
- `legMinutes[]` (length = stops − 1) when `OK`

Exact path/module ownership (calendar vs carpool vs leaveby composition) is an
implementation choice; carpool/coverage write paths must call into leaveby (or a
thin orchestrator) to build/invalidate the cached route. Soft-fail geocode/OSRM
→ `UNAVAILABLE` (config fallback duration may be used for a leg only if it
matches existing leave-by policy — document in code; never present fixture
minutes as live).

**Web:** `FamilyScreen` / `RideDetailScreen` fetch the new API when opening
detail (or when the routable row’s ride/coverage state changes). Pass live
schedule into `RideRouteTab`; keep using
[`rideScheduleUtils`](../../web/src/components/rideScheduleUtils.ts)
(`computeSchedule`, `navigationUrl`, `embedUrl`). Map embed / keyless
placeholder behavior unchanged. Playlist tab may keep fixtures this PR.

**Notify:** keep shell local sending/sent UI; channel-agnostic call site that
**no-ops / soft-fails** (no network). Real delivery waits on
`push-notifications`.

**Clients:** update **web** API client in the same change. Do **not** update
frozen KMP `sharedLogic`.

## Context

Allowlist for `/implement`:

- Design / mockup SoT:
  [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  → fixture `carpoolRoute` (~L64–115); `RouteMap` / `NotifyAction` / `StopRow` /
  `RouteTab` (~L716–880)
- Tokens (reuse unless a new role is required):
  [`docs/ui-system.md`](../../ui-system.md);
  [`design-tokens/tokens.json`](../../../design-tokens/tokens.json) `rideDetail*`
- Architecture:
  [`docs/architecture.md`](../../architecture.md) → **Leave-by** (OSRM PoC,
  `leaveby_route_cache`, estimate wording);
  **Team carpool space** (accept rules);
  **Coverage** (CONFIRMED paths)
- Prior decisions:
  [`docs/specs/archive/ride-detail-shell.md`](../archive/ride-detail-shell.md)
  (fixture Route + deferred live legs);
  [`docs/specs/archive/ride-detail-schedule-utils.md`](../archive/ride-detail-schedule-utils.md)
  (locked client math);
  [`docs/specs/archive/carpool-pickup-detour.md`](../archive/carpool-pickup-detour.md)
  (pairwise OSRM via `LeaveByApi`, default origin);
  [`docs/specs/archive/event-leave-by-estimate.md`](../archive/event-leave-by-estimate.md)
  (OSRM soft-fail + route cache)
- Backend entry points:
  [`backend/modules/leaveby/`](../../../backend/modules/leaveby/) (`LeaveByApi`,
  `OsrmPort`, route cache);
  [`backend/modules/carpool/`](../../../backend/modules/carpool/)
  (`CarpoolRideService.accept` / cancel / withdraw);
  coverage confirm/assign under
  [`backend/modules/coverage/`](../../../backend/modules/coverage/)
- Contract: [`contracts/openapi.yaml`](../../../contracts/openapi.yaml)
  (carpool rides + calendar coverage; no route fields yet)
- Web:
  [`web/src/components/RideRouteTab.tsx`](../../web/src/components/RideRouteTab.tsx),
  [`web/src/components/RideDetailScreen.tsx`](../../web/src/components/RideDetailScreen.tsx),
  [`web/src/components/FamilyScreen.tsx`](../../web/src/components/FamilyScreen.tsx),
  [`web/src/components/canRoute.ts`](../../web/src/components/canRoute.ts),
  [`web/src/components/rideDetailFixtures.ts`](../../web/src/components/rideDetailFixtures.ts),
  [`web/src/components/rideScheduleUtils.ts`](../../web/src/components/rideScheduleUtils.ts),
  [`web/src/api/carpoolClient.ts`](../../web/src/api/carpoolClient.ts),
  [`web/src/api/familyClient.ts`](../../web/src/api/familyClient.ts)

## Acceptance criteria

- [ ] OpenAPI defines a calendar/ride **route read** returning `status`,
      `bufferMinutes`, ordered `stops`, and `legMinutes` (when `OK`); web API
      client updated in the same change; no KMP client updates.
- [ ] On teammate **accept** and household coverage **confirm** / self-assign
      **CONFIRMED**, the server builds and persists the multi-stop itinerary
      (home → pickups → destination) using leaveby geocode + pairwise OSRM +
      existing route-duration cache.
- [ ] GET returns the cached route when the stop fingerprint still matches; a
      fingerprint-changing write (withdraw/cancel accepted ride, end confirmed
      coverage, leave-from/place/destination change) invalidates or recomputes
      before the next successful read.
- [ ] `bufferMinutes` is **45** (game) / **20** (practice) / **0** (other) per
      the locked heuristic; not editable in this PR.
- [ ] When `canRoute` and the API returns `OK`, Route tab leave-by hero, stop
      times (`computeSchedule`), Start navigation, and map embed/placeholder use
      **live** stops/`legMinutes` — not game/practice fixtures.
- [ ] When routing is `UNAVAILABLE`, the Route tab shows a minimal honest
      unavailable state (no silent fixture leave-by presented as live).
- [ ] Notify ready-by keeps local sending/sent UI only (channel-agnostic call
      site; no push/SMS/network delivery).
- [ ] Playlist tab may remain fixture-driven; no Spotify/OAuth work.
- [ ] UI copy continues to say **estimate** (never live traffic / ETA).
- [ ] Backend unit + integration tests for build/cache/invalidate and GET
      auth/gate; web component tests prove live props drive Route tab (and
      unavailable path).

## Tasks

- [x] Contract: add route read schema + path to `contracts/openapi.yaml`; keep
      web `api/` types/client in sync
- [x] Backend (`leaveby`): multi-stop ordered `legMinutes` helper reusing
      `OsrmPort` / geocode / `leaveby_route_cache`; persist itinerary + fingerprint
- [x] Backend (`carpool` / `coverage` / calendar orchestration): trigger
      build/invalidate on accept, confirm/self-assign, withdraw/cancel, coverage
      remove, and fingerprint-related place/leave-from updates; expose GET
- [ ] Web: fetch route when opening ride detail; wire `RideRouteTab` to live
      data; align fixture helpers/tests with 45/20/0 buffers where still used
      for playlist or offline demos
- [ ] Web: minimal `UNAVAILABLE` Route state (polish owns richer chrome later)
- [ ] Notify: leave call-site as no-op / local-only (document hook for push)
- [ ] Tests: leaveby/carpool/coverage unit + API integration; `RideRouteTab` /
      `FamilyScreen` (or detail host) tests for OK + UNAVAILABLE; no live OSRM
      in CI (stub provider)

## Open questions

Resolved at `/spec`:

- **Buffer:** 45 / 20 / 0 until `event-arrival-lead-time`.
- **Compute:** cache on accept/confirm + fingerprint invalidation (OSRM is not
  live traffic).
- **Contract:** yes — dedicated route read.
- **Notify:** call-site / local UI only until `push-notifications`.

Still open (implementer may choose within Approach):

- ~~Exact OpenAPI path and which Modulith module owns the HTTP resource
  (calendar vs carpool)~~ — **chosen:** `GET /api/family/circle/calendar/{source}/{itemId}/route`
  under family/calendar (HTTP resource); leaveby still owns duration math/cache.
  Confirm paths still trigger build/invalidate in later tasks.
