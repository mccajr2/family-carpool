# Spec: day-block-route

Status: done  
Created: 2026-09-14  
Promoted: 2026-09-16 · `/spec`  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-14 · enhancement  
Branch: `day-block-route`

## Problem

Agenda already groups a confirmed multi-event drive into one card
([`day-block-agenda`](../archive/day-block-agenda.md)), but **View route** still
opens the **single-event TO** itinerary for one representative item. Parents
driving a block (household afterschool stops + teammate pickups + shared venue
timing) cannot see or optimize the **full stop sequence**, and the Route page
still has **no Back (FROM) itinerary** — deferred from
[`carpool-route-optimize`](../archive/carpool-route-optimize.md). Without both,
the day-block product story stops at list chrome.

## Non-goals

- Inventing a new Route shell (reuse [`ride-route-tab`](../archive/ride-route-tab.md)
  chrome / `RideRouteTab`)
- Reimplementing stop-order **permutation / duration search** — call the
  existing `StopSequenceOptimizer` leaveby helper
- First-class public **block id** Route resource (`/blocks/{id}/route`) —
  north star after [`agenda-block-api`](../planned/agenda-block-api.md); this
  slice keeps the item-path entry and keys persistence by member-set (see
  Approach)
- Changing driving-block **merge rule** / override API
  ([`day-block-domain`](../archive/day-block-domain.md))
- Agenda / Focus card chrome beyond wiring **View route** to the dual-leg
  block itinerary
- Playlist / music
- Cross-family block merging
- Editable arrival lead times (`event-arrival-lead-time`)
- Route polish beyond what already ships (`ride-detail-polish`)
- Expo / KMP / RN

## Approach

**Web-first. Contract: extend existing item route; assemble the combined
block for the requested leg.**

1. **Entry stays** `GET/PUT /api/family/circle/calendar/{source}/{itemId}/route`.
   Add required-or-default query (and matching PUT) **`leg=TO|FROM`** (default
   **TO** for back-compat). Caller may open Route from any member item in the
   combined component.

2. **Block resolution (server):** For the signed-in adult and requested `leg`,
   resolve the **combined driving-block component** that contains this item
   (same adjacency / `combined: true` closure as
   [`day-block-domain`](../archive/day-block-domain.md) / Agenda). Singleton
   (one-item) blocks keep today’s single-event shape for that leg. Not the
   confirmed driver on that leg → same **403** routability gate as today.

3. **Stop assembly (per leg) — callers build waypoints; optimizer only
   orders middles:**
   - **TO:** fixed start = driver's membership **default** leave-from when the
     resolved block has 2+ members (governing origin for the merged drive);
     singleton blocks still use the path item's leave-from override chain.
     Reorderable middles = household kid leave-from / afterschool places for
     kids the viewer is driving on that leg across **all member events**
     (coverage leave-from **and** CONFIRMED household ride-plan family-side
     places), plus ACCEPTED teammate pickups on that leg for those events; fixed end = shared
     venue (domain already requires same venue identity). Leave-by clock =
     **earliest member** `startsAt − bufferMinutes` (existing title heuristic
     on that earliest item) — matches the optimize north-star.
     Per-event coverage “picked up at …” must **not** become the itinerary
     HOME start on a combined block (see follow-up
     [`block-route-origin`](../planned/block-route-origin.md) for an explicit
     block-level origin override UI).
   - **FROM:** fixed start = venue; reorderable middles = home-side stops for
     riders on the FROM leg across member events; fixed end = driver’s
     leave-from / home. ADR-0004 rule 4: label home-side middles as
     **drop-off**, not pickup.
   - ADR-0004 rule 5 (named/qualified addresses) and rule 8 (merge co-located
     siblings into one middle **before** optimize) apply on assembly.
   - Soft-fail missing geocode/duration → `UNAVAILABLE` (no invented minutes).

4. **Persistence key:** Do **not** invent a public block UUID. Persist /
   fingerprint the itinerary under a **deterministic member-set key**:
   `(adultId, leg, ordered member source+itemId list)`. Opening the same
   combined set via any member `itemId` returns the **same** cached
   itinerary. Fingerprint invalidate/rebuild rules stay as today (stop set /
   addresses change → re-auto-optimize; manual drag lasts until rebuild).
   Document that [`agenda-block-api`](../planned/agenda-block-api.md) may later
   expose a block id as an alias onto this store.

5. **Optimize + drag:** On build / fingerprint refresh with 2+ geocodable
   middles, call existing `StopSequenceOptimizer`. Driving adult may `PUT`
   reorder middles for that **leg** (same permutation contract, scoped by
   `leg`). Reuse pairwise OSRM / `leaveby_route_cache` — no second duration
   cache.

6. **There / Back chrome (web):** On the Route page, **tabs or dual sections**
   (prefer tabs) for There (TO) and Back (FROM) — not time-only auto-switch.
   Each tab fetches/reorders with its `leg`. Show a leg when the viewer is the
   confirmed driver on that leg for the resolved block; if only one leg is
   routable, the other tab is absent or an honest empty/unavailable state (no
   fixture). Keep existing dark leave-by / Hero-type Route treatment; no new
   visual language from mock density.

7. **Agenda:** Block-card **View route** opens this dual-leg Route for the
   block (any representative member item + default There). Remove the
   interim “representative single-event only” limitation from
   `day-block-agenda`.

**OpenAPI:** Document `leg` on get/reorder; document block assembly +
member-set cache key behavior; extend stop `kind` with **`dropoff`** (FROM
middles) while keeping `pickup` for TO middles; optional response echo of
`leg` + ordered `memberItemIds` (source+id) so clients can assert block
scope. Update **web** API clients in the same change. Do **not** update
frozen KMP.

## Context

Allowlist for `/implement`:

- Decision: [`docs/decisions/ADR-0004-carpool-card-perspective-rules.md`](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  — especially rules 4 (direction-correct pickup/drop-off), 5 (named/
  qualified addresses), 8 (single-stop multi-kid)
- Mockup SoT (stop list / wording / grouping — not color or raw density):
  [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
  → Route page section; [`docs/ui-system/carpool-card-perspective-rules.mockup.html`](../../ui-system/carpool-card-perspective-rules.mockup.html)
- Prior slices:
  - [`docs/specs/archive/carpool-route-optimize.md`](../archive/carpool-route-optimize.md)
    (reusable optimizer + deferred There/Back)
  - [`docs/specs/archive/ride-route-tab.md`](../archive/ride-route-tab.md)
    (Route shell, fingerprint, buffers)
  - [`docs/specs/archive/day-block-domain.md`](../archive/day-block-domain.md)
    (combined component / venue / leg)
  - [`docs/specs/archive/day-block-agenda.md`](../archive/day-block-agenda.md)
    (View route interim → replace)
- Architecture: [`docs/architecture.md`](../../architecture.md) → **Leave-by**
  → **Multi-stop itinerary** and **Stop-sequence optimize**
- Contract: [`contracts/openapi.yaml`](../../../contracts/openapi.yaml) →
  `GET/PUT …/calendar/{source}/{itemId}/route`, `CalendarRoute`,
  `CalendarRouteStopKind`, `ReorderCalendarRouteRequest`
- Backend: `backend/modules/leaveby/.../LeaveByApi.java`,
  `LeaveByApiImpl.java` (`buildAndPersistCalendarRoute`, reorder),
  `StopSequenceOptimizer.java`, itinerary persist / fingerprint;
  driving-block resolution from calendar / day-block compute used by
  `driveBlockLinks`
- Web: `web/src/api/familyClient.ts` (`getCalendarRoute` / reorder),
  `web/src/api/types.ts`, `web/src/components/RideRouteTab.tsx`,
  `AgendaBlockCard.tsx` (View route), `FamilyScreen.tsx` (route fetch /
  pass-through), schedule helpers used by Route

Do not list `docs/roadmap.md`. Cite
[`agenda-block-api`](../planned/agenda-block-api.md) only as follow-up /
north-star for public block ids.

## Acceptance criteria

- [x] `GET …/route` accepts `leg=TO|FROM` (default TO). For a multi-item
      combined TO block, response stops include **all** assembled middles for
      that block (household + teammate on that leg), not only the path item’s
      single-event pickups; end is the shared venue; leave-by targets the
      **earliest** member event’s `startsAt − bufferMinutes`.
- [x] Opening Route via **any** member `itemId` of the same combined
      component + same `leg` returns the **same** ordered itinerary (member-set
      cache key).
- [x] `GET …/route?leg=FROM` for a routable FROM block returns venue →
      drop-off middles → home; home-side stops are kind **`dropoff`** (not
      labeled pickup). ADR-0004 named/qualified addresses and co-located
      multi-kid merge apply.
- [x] Build / fingerprint refresh with 2+ geocodable middles calls existing
      `StopSequenceOptimizer` (no second permutation engine). Soft-fail →
      `UNAVAILABLE`.
- [x] Driving adult `PUT` reorder with `leg` persists middle order for that
      leg until the next fingerprint rebuild re-auto-optimizes; non-driver /
      wrong leg → 403.
- [x] Web Route shows **There / Back** tabs (or dual sections); each loads /
      reorders its `leg`. Agenda block **View route** opens this chrome
      (default There). Singleton one-event drives get the same dual-leg UI
      when both legs are routable.
- [x] OpenAPI + web `familyClient` / types updated in the same change; KMP
      untouched. No public `/blocks/{id}/route` in this PR.
- [x] Unit + integration coverage for block TO assembly, FROM assembly +
      dropoff kind, member-set cache equivalence across itemIds, and
      There/Back client tab fetch; existing single-event TO default remains
      green.

## Tasks

- [x] Backend: resolve combined block for `(adult, leg, item)`; assemble TO /
      FROM waypoint lists (merge co-located); persist under member-set key;
      wire optimize + reorder scoped by `leg`; extend stop kind `dropoff`
- [x] Contract: OpenAPI `leg` on get/reorder; `CalendarRouteStopKind.dropoff`;
      document block assembly + member-set key; optional `leg` /
      `memberItemIds` on `CalendarRoute`; update architecture Leave-by rows
      that still say “single-event TO only”
- [x] Web: `familyClient` + types for `leg`; Route There/Back tabs; drag per
      active leg; AgendaBlockCard / FamilyScreen View route → dual-leg Route
- [x] Tests: leaveby unit (assembly + optimizer caller); integration (block
      multi-stop + FROM + same itinerary via two itemIds + reorder); web
      `RideRouteTab` There/Back + `AgendaBlockCard` / FamilyScreen View route;
      OpenAPI contract assertions

## Open questions

- None blocking for this PR. Follow-up governing origin UI:
  [`block-route-origin`](../planned/block-route-origin.md) (promote via `/spec`
  immediately after merge / smoke of default-home fix).
