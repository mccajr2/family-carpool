# Spec: event-leave-by-estimate

Status: draft  
Created: 2026-08-07  
Updated: 2026-08-11  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `event-leave-by-estimate`  
Added: 2026-08-07 · re-rank split

## Problem

Adults see a unified Agenda but still guess when to leave. Named places already
exist as origins (with optional lat/lng), and events carry free-text
`location`, yet nothing turns “Mom’s house → rink at 6:00” into an **estimated
leave-by**. Without that, the calendar pillar’s “when to leave” promise is
missing for the PoC.

## Non-goals

- **Activity-type arrival lead times** (game ~30 min early, practice ~15,
  other ~0, editable) — follow-up
  [`event-arrival-lead-time`](../planned/event-arrival-lead-time.md)
- Multi-stop teammate pickups — `driver-leave-by-pickups`
- Paid live traffic; in-app turn-by-turn; presenting leave-by as live ETA
- Conflict detection / coverage assignment
- Linking events to destination **named places** (destination stays free-text
  `location` + geocode this slice)
- Changing feed sync / manual event CRUD beyond leave-from + estimate surfaces
- Restyling Calendar onto the shared UI token system (still
  `ui-system-destination-adoption`)

## Approach

**Destination coords (locked):** Geocode each calendar item’s free-text
`location` via the existing Nominatim/cache pattern (soft-fail). No destination
place foreign key in this PR.

**Leave-from:** Per **signed-in adult** + calendar item (`source` + `id`), store
an optional `leaveFromPlaceId` (circle place). Default when unset: the circle’s
first **located** place by name (stable sort); if none located, leave-by is
unavailable until the adult picks a located place or locates one under Places.

**Estimate math (locked decision):**  
`leaveBy ≈ startsAt − (travelDuration × timeOfDayMultiplier + fixedBuffer)`  
- Travel: **OSRM** driving duration when origin and destination both have
  coords; else a documented **fallback** duration (config constant).  
- Apply a simple **time-of-day multiplier** and a **fixed buffer** (config).  
- UI copy always says **estimate** (never “live traffic” / “ETA”).

**Module shape:** New Spring Modulith module (e.g. `leaveby`) owns OSRM port +
stub, fallback/TOD/buffer config, per-adult leave-from persistence, and
estimate computation. `family` exposes a small public place-lookup API for
coords by id (no OSRM inside `family`). `calendar` enriches `GET …/calendar`
responses for the current adult (compose only).

**Contract:** Extend `CalendarItem` with leave-by fields for the current adult
(e.g. `leaveFromPlaceId`, `leaveFromPlaceName`, `leaveByAt`, `leaveByStatus`
such as `OK` | `UNAVAILABLE`, optional `leaveByReason`). Add
`PUT` (or `PATCH`) to set leave-from for a calendar item id+source. Web +
Android + iOS clients update in the same change. CI uses stub OSRM + stub/cached
geocode (no live public hosts required in tests).

**Clients:** Agenda rows show leave-by when `OK` (e.g. “Leave by ~3:40 ·
estimate”); when unavailable, a short reason or omit. Adult can change
leave-from from the Agenda row or a light sheet/menu using circle places
(located ones selectable; not-located disabled or labeled).

## Acceptance criteria

- [ ] Any circle member can set **their** leave-from place for a MANUAL or FEED
      calendar item; unknown place / other circle → 404; place without coords
      rejected or yields `UNAVAILABLE` (document one behavior).
- [ ] `GET /api/family/circle/calendar` includes leave-by fields for the
      **current adult** on each item (defaults applied when no override).
- [ ] When origin place and destination `location` both resolve to coords and
      OSRM succeeds, `leaveByAt` is computed with TOD multiplier + fixed buffer;
      UI labels it an **estimate**.
- [ ] Soft-fail path: missing/blank location, geocode failure, or OSRM failure
      still returns the calendar item with `leaveByStatus=UNAVAILABLE` (or
      fallback duration — pick one primary behavior in implement and test it);
      never fails the whole calendar GET.
- [ ] No live-traffic wording in client UI strings.
- [ ] OpenAPI + web + Android + iOS clients updated together; `ModularityTests`
      passes with the new module; unit + integration tests cover estimate math,
      leave-from authz, and soft-fail.
- [ ] Activity-type arrival lead times are **not** implemented (tracked as
      `event-arrival-lead-time`).

## Tasks

- [ ] **Contract:** Extend `CalendarItem`; add set-leave-from path; document
      status/reason enums and soft-fail behavior in `contracts/openapi.yaml`.
- [ ] **Backend (`family`):** Public place lookup (id → coords/name) for members;
      keep Nominatim geocode reusable for destination strings (cache key =
      normalized location) without stuffing OSRM into `family`.
- [ ] **Backend (`leaveby` module):** Persist per-adult leave-from; OSRM port +
      stub; estimate service (TOD + buffer + fallback); wire into calendar read
      enrichment; config via env (OSRM base URL, buffer, multipliers, fallback).
- [ ] **Web:** Agenda leave-by line + leave-from control; copy says estimate;
      client types/API aligned with OpenAPI.
- [ ] **Android (sharedUI):** Same Agenda affordances.
- [ ] **iOS:** Same Agenda affordances.
- [ ] **Docs:** `docs/architecture.md` — leave-by module, estimate formula,
      soft-fail; pointer to `event-arrival-lead-time` follow-up.
- [ ] **Tests:** Estimate unit tests (OSRM ok / fallback / missing coords);
      integration for leave-from + calendar enrichment; client tests for display
      / set leave-from; `ModularityTests`.

## Open questions

*Resolve on approve (defaults below if silent):*

| Topic | Proposed default |
|-------|------------------|
| Soft-fail vs fallback duration when OSRM/geocode fails | Prefer **UNAVAILABLE** (honest) over a fake constant travel time; still apply fallback only when both coords exist but OSRM is down if we want Agenda never blank — **recommend UNAVAILABLE** |
| Default leave-from when unset | First located place by name (case-insensitive); else UNAVAILABLE |
| Who sees whose leave-by | Only the **signed-in adult’s** leave-from/leave-by on calendar GET (not other adults’) |
| Destination geocode cache | Shared/normalized string cache (same spirit as place address cache) |

## Approval

Status stays **draft** until you approve (or amend). No `/implement` until then.
