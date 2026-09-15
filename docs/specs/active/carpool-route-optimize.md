# Spec: carpool-route-optimize

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement  
Promoted: 2026-09-15 · `/spec` — auto stop-order + optional drag  
Updated: 2026-09-15 · `/spec` amend — reusable stop-sequence optimizer for
future day-block / per-leg riders; defer There/Back Route chrome to
`day-block-route`  
Branch: `carpool-route-optimize`

## Problem

Confirmed multi-stop rides already show an **ordered** pickup list and leave-by
([`ride-route-tab`](../archive/ride-route-tab.md)), but stop order is whatever
order pickups were attached — not chosen for a short drive. Neighborhood-style
pickups need the app to **optimize stop order** (and refresh leave-by / maps
deep link) without live turn-by-turn or a paid traffic product. Drivers also
need a light **manual override** when the estimate is wrong for their street
knowledge — without locking that override across later route rebuilds.

**North-star (not shippable in this PR):** one continuous TO drive can mix
household kid pickups (different afterschool places), teammate carpool pickups,
and a shared venue for back-to-back practices — e.g. Family 1 dad leaves home →
kid 1 at community center → kid 2 at school → Family 2 siblings at their house
→ rink in time for Team 1 practice (6pm) with practice buffer, while Team 2
(7pm, same rink) is the next event in the same drive. The **FROM** leg needs
the same kind of optimize over whoever is on *that* leg. Calendar/block
assembly for that scenario lands in `day-block-*`; this slice must ship an
optimizer those specs can call without reinventing permutation / duration
search.

## Non-goals

- Rebuilding the Route tab shell / map chrome (already shipped)
- Live navigation inside the app / paid live traffic / Google Directions as
  primary routing
- Playlist / music
- One-way-only product changes or meet-at shape work (already shipped separately)
- Reviving cancelled `carpool-multi-stop` as a second Route UI
- Assembling **driving blocks**, multi-event stop lists, or household-kid
  afterschool waypoints (`day-block-domain` → `day-block-agenda` →
  `day-block-route`) — this PR only **wires** optimize into today’s
  **single-event** Route (teammate ACCEPTED pickups → venue). Block Route
  supplies a longer waypoint list to the **same** optimizer later.
- **There / Back Route chrome** (tabs, dual sections, or time-based switch) and
  building a **FROM** itinerary for the Route page — Route stays **there
  (TO) only** in this PR. Consider dual-leg Route UI + FROM stop assembly at
  `/spec day-block-route` (prefer tabs/sections over time-only so the return
  is planable). Until then, FROM optimize is a documented caller shape only.
- Changing Agenda **single-origin** leave-by math (Route tab multi-stop
  itinerary only)
- Persistent “manual order lock” / dedicated “Optimize route” button that
  survives fingerprint rebuilds
- Expo / KMP UI
- Rich loading / OSRM-unreachable polish beyond what Route already shows
  (`ride-detail-polish`)

## Approach

**Web-first.** Keep server-owned itineraries in `leaveby` (pairwise OSRM +
`leaveby_route_cache` + fingerprint invalidate/rebuild from
[`ride-route-tab`](../archive/ride-route-tab.md)).

**Reusable stop-sequence optimizer (design lock):** Implement optimize as a
**pure leaveby helper** over waypoints — not “sort RideRequest pickups”:

- Fixed **start** (e.g. driver leave-from / home)
- Reorderable **middle** stops (opaque identities + geocoded coords/addresses)
- Fixed **end** (e.g. event venue on a TO leg; home on a FROM leg)
- Objective: minimize total pairwise driving duration (existing
  `OsrmPort` / `leaveby_route_cache` — no second duration cache)
- Brute-force when middle-stop count is small; nearest-neighbor (or similar)
  heuristic above a hard cap (e.g. > 7) so request time stays bounded
- Soft-fail any missing duration → caller gets `UNAVAILABLE` / no invented
  fixture minutes

Callers assemble the waypoint list. **This PR’s only caller** is today’s
single-event calendar-route builder (home → ACCEPTED teammate pickups →
destination). Future `day-block-route` (and per-leg FROM builds) pass a
different middle-stop set — same helper, same drag/recompute write pattern.

**Per-leg reuse (document, don’t ship Back chrome):** The optimizer does not
care about TO vs FROM labels; ADR-0004 direction rules belong to **stop
assembly** (pickup vs drop-off naming). Today’s Route page and this PR’s write
path remain the **TO (“there”)** itinerary only. When `day-block-route` (or a
follow-on) adds There/Back chrome and FROM stop assembly, that caller uses the
same helper with riders-on-that-leg as middle stops and home as the fixed end —
no second permutation engine.

**Leave-by / buffer:** Unchanged math — arrive at the itinerary’s destination
by the destination clock the builder supplies (`startsAt − bufferMinutes` +
sum of `legMinutes`). When day-block later targets “on time for practice 1”
with Team 2 later at the same rink, the **builder** passes Team 1’s start +
practice buffer; optimize still only orders middles.

**Co-located stops:** Prefer merging identical addresses into one middle stop
before optimize when the builder already has that info (ADR-0004 single-stop
multi-kid). This PR may only see one stop per teammate address today; the
helper should accept pre-merged middles so blocks don’t need a second merge
pass inside the optimizer.

**Auto-optimize on build:** `buildAndPersistCalendarRoute` / upsert /
fingerprint refresh calls the helper for 2+ middle stops, then persists
ordered `stops` + `legMinutes` under existing fingerprint rules.

**Optional drag (temporary):** Driving adult may reorder **middle** stops on
the Route tab (start / end fixed). Persist via **OpenAPI write** on the route
resource (e.g. `PUT …/route` with ordered middle-stop identities) → recompute
`legMinutes` for that sequence. Maps deep link + Route leave-by refresh from
the response. **No manual-lock flag:** next fingerprint-driven rebuild
**re-auto-optimizes** and overwrites the drag. Drag is session-until-rebuild.

**Contract:** Document auto-optimize on itinerary build; add the reorder write
(riders can read; only the driving adult may reorder). Update **web** API
client in the same change. Do **not** update frozen KMP `sharedLogic`.

**UI:** Minimal drag affordance on middle (pickup) rows inside existing Route
chrome; no new destination mock — reuse tokens. Drag hidden/inert with fewer
than two middles, `UNAVAILABLE`, or non-driver caller.

## Context

Allowlist for `/implement`:

- Prior decision: [`docs/specs/archive/ride-route-tab.md`](../archive/ride-route-tab.md)
  (stop order, fingerprint invalidate, cache-on-confirm, soft-fail)
- Extension target (read Notes only): [`docs/specs/planned/day-block-route.md`](../planned/day-block-route.md)
- Perspective rules for future stop assembly (do not implement block UI):
  [`docs/decisions/ADR-0004-carpool-card-perspective-rules.md`](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  → rules 4 (direction-correct) and 8 (single-stop multi-kid)
- Architecture: [`docs/architecture.md`](../../architecture.md) → **Leave-by**
  (OSRM PoC, `leaveby_route_cache`) and Team carpool **Rides** route mention
- Contract: [`contracts/openapi.yaml`](../../../contracts/openapi.yaml) →
  `GET /api/family/circle/calendar/{source}/{itemId}/route` + `CalendarRoute`
- Backend: `backend/modules/leaveby/.../LeaveByApi.java`,
  `LeaveByApiImpl.java` (`buildAndPersistCalendarRoute`), `OsrmPort.java`,
  `ItineraryFingerprint.java`, itinerary persist/JSON
- Web: `web/src/api/familyClient.ts` (`getCalendarRoute`),
  `web/src/components/RideRouteTab.tsx`,
  `rideScheduleFromCalendarRoute.ts`, `rideScheduleUtils.ts`,
  `FamilyScreen.tsx` (route fetch / pass-through)
- Tests entry: `CalendarRouteIntegrationTest`, `LeaveByApiImplTest`,
  `RideRouteTab.test.tsx`, `familyClient` route tests

## Acceptance criteria

- [ ] **Optimizer unit API** takes fixed start, reorderable middle waypoints
      (opaque ids + locations), and fixed end; returns an ordered middle
      sequence (or full path) minimizing total pairwise duration — **no**
      dependency on RideRequest / calendar-item types inside the helper.
- [ ] On single-event itinerary **build / fingerprint refresh**, when there
      are **2+** geocodable middle (pickup) stops and routing is `OK`,
      persisted order is that helper’s result (or documented heuristic over
      the brute-force cap); start remains first and end last.
- [ ] With **0 or 1** middle stop, behavior matches today’s shape; `OK` /
      `UNAVAILABLE` soft-fail rules unchanged.
- [ ] A **fingerprint change** rebuilds with a **fresh auto-optimize** — any
      previously dragged order is discarded.
- [ ] **OpenAPI:** documented auto-optimize on build; new **write** on the
      route resource that accepts an ordered list of current middle-stop
      identities, recomputes `legMinutes`, persists under the **same**
      fingerprint, and returns `CalendarRoute`. Unknown / mismatched stops →
      **400**; caller not the driving adult → **403**; same 404/401 as GET.
- [ ] Web: driving adult with **2+** middles can **drag-reorder** on Route;
      successful write refreshes stop list, leave-by copy, and maps deep link.
      Non-drivers cannot reorder.
- [ ] Web API client updated in the same change; frozen KMP untouched.
- [ ] Unit tests: (1) helper chooses a shorter permutation than input order;
      (2) helper accepts an arbitrary middle-stop list that mimics the
      north-star shape (e.g. two household places + one teammate house →
      venue) without calendar/block fixtures — proves reuse without shipping
      block assembly. Integration: build-optimize + reorder write + rebuild
      clears manual. Web: drag success + non-driver / single-middle inert.
- [x] Architecture Leave-by / route blurb notes: stop order is optimized via
      a reusable waypoint helper; today’s caller is single-event Route; block /
      per-leg FROM callers come later.

## Tasks

- [x] Backend (`leaveby`): extract **waypoint stop-sequence optimizer**
      (pairwise durations + cap/heuristic); no calendar/RideRequest types in
      the helper
- [x] Backend (`leaveby`): call helper from single-event itinerary
      build/refresh paths
- [x] Backend (`leaveby` / calendar controller): reorder write that recomputes
      legs for a supplied middle-stop order without changing fingerprint
      identity
- [x] Contract: OpenAPI — document optimize-on-build; add route reorder write +
      request schema; bump contract version / `OpenApiContractTest` as usual
- [x] Web: `familyClient` reorder method; wire Route tab drag for driving adult;
      refresh schedule/maps from response; `FamilyScreen` (or host) passes
      driver capability + save handler
- [x] Tests: helper unit (optimize + heuristic cap + north-star-shaped waypoint
      list); calendar/leaveby integration (optimize on build, PUT reorder,
      fingerprint rebuild clears manual); web `RideRouteTab` / client tests
- [x] Docs: architecture Leave-by / route blurb — reusable optimizer; single-
      event wired now; day-block / FROM reuse later
- [ ] Docs: note on [`day-block-route`](../planned/day-block-route.md) stub —
      consume this helper; do not reimplement permutation search

## Open questions

- None blocking — product choices locked: **auto + optional drag**;
  **re-auto-optimize on fingerprint rebuild**; **helper is waypoint-generic**
  for day-block / per-leg reuse; **Route stays TO (“there”) only** — There/Back
  chrome + FROM itinerary deferred to `/spec day-block-route`. Exact
  brute-force cap and middle-stop wire identity are implementer details as
  long as AC hold.
