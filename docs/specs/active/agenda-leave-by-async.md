# Spec: agenda-leave-by-async

Status: in-progress  
Created: 2026-08-13  
Approved: 2026-08-13  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-leave-by-async`  
Added: 2026-08-13 · enhancement

## Problem

`GET /api/family/circle/calendar` enriches **every** row with leave-by before
returning: Nominatim (event `location`) plus OSRM (driving duration). A cache
miss — first install, new adult, or empty store — waits on travel estimates
before any Agenda rows appear, even though events, coverage, and conflicts are
already in Postgres. Leave-by is a progressive enhancement; the schedule must
paint first. Near-term items should get estimates before later days.

## Non-goals

- Changing leave-by **math**, origin order, OSRM-down fallback, or “estimate”
  copy (`event-leave-by-estimate`)
- Materializing leave-by onto events at feed-poll time (no precompute-on-sync;
  duration cache is keyed by route, not stored on the calendar item)
- **`ETag` / `304`** — follow-up
  [`calendar-conditional-get`](../planned/calendar-conditional-get.md)
- Offline write queue / full offline editing
- Shrinking the stored event window (events are cheap; the lag is enrichment)
- Arrival lead times (`event-arrival-lead-time`), per-coverage leave-from
  (`coverage-leave-from`), travel-margin warns (`conflict-travel-margin`)
- WebSockets / SSE / push to deliver leave-by
- Restyling Calendar onto shared UI tokens (`ui-system-destination-adoption`)
- Changing coverage or conflict rules (those stay on the cheap list — DB only)

## Approach

### Cheap calendar list (locked)

`GET /api/family/circle/calendar` **must not** call Nominatim or OSRM HTTP. It
still merges feed + manual items, coverage, and conflicts, and still resolves
**leave-from** from DB (override → membership default → first located place).

It **may** read `geocode_cache` and the leave-by duration cache and run the
existing leave-by math in-process. Warm unique venues can therefore return
`OK` on the list with no fill-in and no upstream HTTP. Those reads must be
**cache-only** — a miss stays `PENDING`; the list must not fall through to
Nominatim or OSRM.

`leaveByStatus` on the list:

| Situation (cheap) | `leaveByStatus` | `leaveByReason` | `leaveByAt` |
| ----------------- | --------------- | --------------- | ----------- |
| No located origin | `UNAVAILABLE` | `NO_ORIGIN` | null |
| Origin OK, blank/missing `location` | `UNAVAILABLE` | `NO_DESTINATION` | null |
| Origin OK, dest + duration **both** in DB cache | `OK` | null | computed |
| Otherwise (needs Nominatim and/or OSRM HTTP) | `PENDING` | null | null |

`leaveFromPlaceId` / `leaveFromPlaceName` stay populated when origin resolved.

Update the OpenAPI description of `listCircleCalendar` so it no longer claims
the list performs live OSRM/Nominatim enrichment.

### Fill-in endpoint (locked)

New `GET /api/family/circle/calendar/leave-by?from&to` (same auth, same
half-open `[from, to)`, same 400/401/404 as the list):

- Returns an array of **`CalendarLeaveBy`**: `source`, `id`, leave-from fields,
  `leaveByAt`, `leaveByStatus` (`OK` \| `UNAVAILABLE` — not `PENDING`),
  `leaveByReason`.
- Full enrich per matching item (geocode + OSRM + existing math / fallback),
  **reusing caches** (below).
- Soft-fail per row; never fails the whole response for one bad venue.
- Clients patch by `(source, id)`; ignore unknown ids; leave a row `PENDING` if
  omitted.

`LeaveByApi` splits **cheap origin/status** (DB only, including cache reads)
vs **full enrich** (cache then HTTP). Calendar list uses cheap; this path and
**single-item mutation responses** (leave-from PUT, coverage writes that return
a `CalendarItem`) still **fully enrich that one row** so the row the adult just
edited updates immediately.

### Duplicate destinations / route cache (locked)

Many Agenda rows share a venue (same `location` text) and often the same
leave-from. **Do not** call Nominatim or OSRM again for a lookup already
answered.

| Lookup | Store | Key | Behavior |
| ------ | ----- | --- | -------- |
| Destination geocode | Existing **`geocode_cache`** (`FamilyGeocodeApi` — do not bypass) | Normalized location (trim + lower-case, same as today) | Hit → coords, no Nominatim. Miss → Nominatim, persist **successful** coords only (today’s rule). |
| Driving duration | **New** table in `leaveby` (same pattern as `geocode_cache`; none exists today) | Origin + dest coordinates, rounded the same as the OSRM request (6 decimal places) | Hit → seconds, no OSRM HTTP. Miss → OSRM, persist **successful** durations only. |

**In-request collapse:** one fill-in range (or list cache-read pass) resolves
each distinct normalized location **once** and each distinct origin+dest pair
**once**, then applies the result to every matching row.

**Do not cache:** Nominatim misses (`GEOCODE_FAILED`), OSRM failures, or the
config **fallback** duration. Those must retry next time so a blip does not
stick. Different origins to the same venue are different OSRM keys (one
geocode, N durations).

This is **not** storing `leaveByAt` on the event. TOD/buffer math still runs
per row from cached travel seconds + that item’s `startsAt`.

### Client fill-in (locked)

Web + Android + iOS, together with the contract:

1. Paint Agenda from cache and/or cheap list **without waiting** on leave-by.
2. After the cheap list for a window is on screen (or cache already showing),
   fetch leave-by in slices:
   - **Near-term first:** `[localTodayStart, localTodayStart + 2 calendar days)`
     intersected with the loaded window.
   - **Then** the remainder of the currently loaded window (one request is
     fine).
3. **Load more:** after the appended page paints, fill **that page’s** `[from,
   to)` only (later days; do not start this before the near-term request for
   the initial window).
4. Patch matching rows; persist the calendar cache snapshot.

Server may compute a range in `startsAt` order, but **clients must slice** so
near-term HTTP latency is not coupled to the 30-day tail.

### PENDING UI (locked)

On the existing leave-by line, while `PENDING`: show focused busy copy
(**Estimating leave-by…**) — not a full-row or full-screen spinner, not blanking
coverage / conflicts / leave-from. Leave-from picker stays usable. No
live-traffic / ETA wording. When fill-in returns, same OK / UNAVAILABLE copy as
today.

### Cache merge (locked)

When applying a cheap list item onto an in-memory/cached row:

- Incoming **`UNAVAILABLE`** (cheap settled) → use it (clears a stale `OK`).
- Incoming **`PENDING`** and `leaveFromPlaceId` **equals** cached origin and
  cached status is `OK` or `UNAVAILABLE` → **keep cached leave-by** until
  fill-in (avoid flicker).
- Incoming **`PENDING`** and origin **differs** (or no cached leave-by) → show
  `PENDING`.
- Fill-in **always** overwrites leave-by fields for that `(source, id)`.
- Fill-in **failure**: keep last known leave-by (cached settled or `PENDING`);
  do not wipe Agenda. Soft error optional, same pattern as calendar revalidate
  failure.

Sign-out / identity change still clears the calendar cache.

## Acceptance criteria

- [ ] `GET /api/family/circle/calendar` does **not** invoke Nominatim or OSRM
      HTTP (test double that fails if called). Cache-miss travel rows return
      `PENDING`; cache-hit dest+duration rows may return `OK` with computed
      `leaveByAt`.
- [ ] Cheap list returns `UNAVAILABLE` + `NO_ORIGIN` / `NO_DESTINATION` without
      fill-in; those rows do not require the leave-by endpoint to show recovery
      copy.
- [ ] `GET /api/family/circle/calendar/leave-by?from&to` returns full enrich
      (`OK` or `UNAVAILABLE`, including `GEOCODE_FAILED` / OSRM-down fallback)
      for items in `[from, to)`; 400/401/404 match the list.
- [ ] Two (or more) items with the same normalized `location` and same origin
      coords in one fill-in cause **at most one** Nominatim HTTP and **at most
      one** OSRM HTTP; further rows use cache / in-request reuse.
- [ ] A second fill-in (or cheap list) after a successful dest+route lookup
      performs **zero** Nominatim/OSRM HTTP for that pair (DB cache hit).
- [ ] OSRM-down fallback and geocode miss are **not** persisted; a later
      fill-in may retry upstream.
- [ ] Leave-from PUT and coverage mutation responses still return a fully
      enriched `CalendarItem` (one-row sync enrich).
- [ ] **Web + Android + iOS:** Agenda rows from a cheap list (or cache) are
      visible **before** the leave-by request completes (observable: items on
      screen while fill-in in flight).
- [ ] Near-term leave-by request (`localTodayStart` + 2 calendar days) is
      issued **before** any later-window leave-by request for that load.
- [ ] `PENDING` shows **Estimating leave-by…** on the leave-by line; leave-from
      and coverage stay interactive; fill-in replaces the line with existing OK
      / UNAVAILABLE copy.
- [ ] Cheap revalidate that returns `PENDING` does not clobber a cached `OK`
      for the same origin; fill-in then updates. Origin change on the cheap
      list drops stale `OK` to `PENDING`.
- [ ] Fill-in failure after rows are shown leaves the list intact.
- [ ] OpenAPI + web + Android + iOS clients updated together; `ModularityTests`
      passes; unit + integration tests cover cheap list isolation, fill-in
      enrich, and client paint-before-fill / near-term-first / cache merge.

## Tasks

- [x] **Contract:** Add `PENDING` to `LeaveByStatus`; document cheap vs fill-in
      on `listCircleCalendar`; add `GET …/calendar/leave-by` + `CalendarLeaveBy`
      schema in `contracts/openapi.yaml`.
- [x] **Backend (`leaveby`):** Split cheap origin/status vs full `enrich`; list
      path must not call Nominatim/OSRM HTTP. Add duration cache (successful
      OSRM only). Fill-in/enrich must use `FamilyGeocodeApi` (existing
      `geocode_cache`) and collapse duplicate locations/routes in-request.
- [x] **Backend (`calendar`):** List uses cheap path; new leave-by range
      endpoint; single-item `requireItem` stays full enrich.
- [x] **Web:** `listCalendarLeaveBy` client; paint-then-fill; near-term slice;
      PENDING copy; cache merge; Load more fill for the appended page.
- [x] **Android (`sharedLogic` / `sharedUI`):** Same behavior in `FamilyUiModel`
      + Agenda leave-by line.
- [ ] **iOS:** Same behavior (`AuthViewModel` / Calendar UI).
- [ ] **Docs:** `docs/architecture.md` — cheap list + async fill-in; reuse
      `geocode_cache` + new duration cache; pointer at
      `calendar-conditional-get` for ETag on the cheap payload.
- [ ] **Tests:** List GET never hits Nominatim/OSRM HTTP; fill-in integration;
      duplicate location/origin → one upstream each; second pass is cache-only;
      fallback/miss not cached; web + `FamilyUiModel` (+ iOS script if that is
      the repo pattern) for paint-before-fill, near-term-first, cache merge,
      fill failure keeps list.

## Open questions

*Resolved for approve unless you amend:*

| Topic | Decision |
|-------|----------|
| List vs extra endpoint | Cheap list + **`GET …/leave-by`** (not a query flag on the list) |
| In-progress status | New enum value **`PENDING`** (not omitted `leaveByStatus`) |
| Cheap UNAVAILABLE | **`NO_ORIGIN` / `NO_DESTINATION`** on the list; HTTP geocode/OSRM only on fill-in (or never, if caches already warm → list `OK`) |
| Duplicate venues | Reuse **`geocode_cache`**; add **OSRM duration cache** (successful hits only); collapse dupes in-request |
| Near-term window | **`localTodayStart` + 2 calendar days** (product default; same spirit as the 5-minute cache TTL) |
| Single-item writes | Still **sync full enrich** on the returned `CalendarItem` |
| Delivery | Second GET (no SSE/WebSocket) |
| Cache flicker | Keep cached settled leave-by across cheap `PENDING` when origin unchanged |

## Approval

**Approved** 2026-08-13. Ready for `/implement`. Do not merge implementation to
`main` without a PR.
