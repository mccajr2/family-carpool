# Spec: carpool-pickup-detour

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Updated: 2026-08-31 (`/spec`)  
Completed: 2026-09-01  
Added: 2026-08-28 · initial  
Branch: `carpool-pickup-detour`

## Problem

Incoming carpool asks on Calendar show who needs a ride and a full pickup
address, but the accepting parent still has to guess **where** pickup really is
and **how far out of their way** it is before Accept or Pass. That makes the
hero carousel and expanded inbound rows a coin flip instead of an informed
decision — especially when multiple asks are in the queue.

## Non-goals

- Fake or static detour minutes in production (no client-side placeholders)
- Multi-stop routing UI, pickup order, or Open in Maps
  ([`carpool-multi-stop`](../planned/carpool-multi-stop.md) stays parked)
- Per-event leave-from override for detour (use the same default origin as
  leave-by: adult default leave-from place, else first located circle place)
- Async fill-in / PENDING detour state on list rides (compute inline on
  `listCarpoolRides`; soft-fail to town-only when routing unavailable)
- Changing v1 ride shape (both legs, pickup at requester's house)
- Carpool tab visual restyle ([`carpool-page-redesign`](../planned/carpool-page-redesign.md))
- Replacing the inbound summary line (`{circle} · kids · seats · pickup`) —
  **add** `PickupLine` under it; do not remove existing density
- Expo / KMP / push
- Surfacing detour on own outbound requests (requester already knows their house)
- Paid live-traffic providers or in-app navigation

## Approach

**Web Calendar + Carpool tab** for surfaces that offer Accept/Pass on inbound
asks. **OpenAPI + backend** for real `detourMinutes` (viewer-specific) and
`pickupTown` (shared display label).

**Visual source:** [`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) `PickupLine` + `pickupTone`. Lock mock hex into new token roles in the same PR (`docs/ui-system.md`).

### Contract (`CarpoolRide`)

Add nullable fields on `CarpoolRide` (all list/create/accept/pass/cancel/withdraw
responses that return a ride):

| Field | Type | When set |
|-------|------|----------|
| `pickupTown` | `string` \| `null` | Parsed display label from `pickupAddress` at serve time (e.g. `Cambridge, MA`). `null` when address cannot yield a town label. |
| `detourMinutes` | `integer` \| `null` | **Only on `otherRequests` rows** for the calling adult. Extra driving minutes vs going straight to the event. `null` when origin, pickup, event location, or OSRM is unavailable (town may still show). |

`detourMinutes` is **not** stored on the ride entity — recomputed per list call
like `passedByMe`.

### Backend detour math (locked)

Reuse the leave-by stack (`FamilyGeocodeApi`, `OsrmPort`, `route_cache`) via a
new public method on `LeaveByApi` (carpool module adds `:leaveby` dependency).

For each **other circle** ride in `listCarpoolRides`:

1. **Origin** — same resolution as leave-by default origin for the calling
   adult (default leave-from place when set, else first located circle place by
   name). No per-event override.
2. **Coords** — geocode `pickupAddress` (ride snapshot) and the feed event's
   `location` string (soft-fail per address).
3. **Durations** (seconds, OSRM driving, cached):
   - `direct` = origin → event
   - `viaPickup` = origin → pickup + pickup → event (sum of two legs; no
     multi-waypoint OSRM extension in this slice)
4. **`detourMinutes`** = `max(0, round((viaPickup − direct) / 60))` when all
   three legs resolve; else `null`.
5. Do **not** apply leave-by TOD multiplier or fixed buffer to detour — raw
   routed driving delta only (labeled **estimate** in UI).

Batch/dedupe geocode + route lookups within one list response (same pattern as
`LeaveByApi.enrichMany`).

**`pickupTown` extraction (locked heuristic):** server-side pure function on
`pickupAddress` — prefer the last `City, ST` segment before an optional ZIP
(e.g. `123 Main St, Cambridge, MA 02139` → `Cambridge, MA`). When no match,
fall back to the full trimmed address (never invent a town).

### Web UI (`PickupLine`)

Shared component used **before** Accept/Pass (or Pass-only) CTAs on:

| Surface | Placement |
|---------|-----------|
| `HeroAttentionSlide` | Replace `heroPickupSummary` one-liner with `PickupLine` on `request` slides |
| `AgendaInboundRequestRow` | Below summary chip row; omit when `showHeroHandoff` |
| `CarpoolSpaceRides` incoming row | Below existing ask summary when Accept/Pass shown |

**Copy (from mock):**

```
Pickup in {pickupTown} · ~{detourMinutes} min out of your way ({tone label})
```

| `detourMinutes` | Tone label | Mock color |
|-----------------|------------|------------|
| ≤ 10 | On your way | `#2F7A4D` |
| 11–20 | Bit of a detour | `#B5793A` |
| ≥ 21 | Far out of the way | `#A6483F` |

When `pickupTown` is null, render nothing. When `pickupTown` is set but
`detourMinutes` is null, show town only (MapPin + `Pickup in {town}`) — no
minutes, no tone parenthetical.

MapPin icon uses tone color when minutes present; secondary text color when
town-only. Hero slide uses `hero` on-secondary base text per mock dark slide.

Wire `pickupTown` / `detourMinutes` through `coverageQueue` `CarpoolRequest`
mapping from `CarpoolRide` for hero queue items.

## Context

- Design: [`docs/ui-system.md`](../../ui-system.md) — Visual source of truth
- Design: [`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) — `PickupLine`, `pickupTone`
- Archived: [`docs/specs/archive/hero-attention-carousel.md`](../archive/hero-attention-carousel.md) — deferred detour on slides
- Archived: [`docs/specs/archive/weekly-list-focus-sync.md`](../archive/weekly-list-focus-sync.md) — `AgendaInboundRequestRow` structure
- Archived: [`docs/specs/archive/event-leave-by-estimate.md`](../archive/event-leave-by-estimate.md) — OSRM + geocode + route cache pattern
- Archived: [`docs/specs/archive/carpool-request-accept.md`](../archive/carpool-request-accept.md) — v1 pickup-at-requester-house
- Source: `contracts/openapi.yaml` → `CarpoolRide`, `listCarpoolRides`
- Source: `backend/modules/carpool/internal/CarpoolRideService.java` — `list`, `toRideResponse`
- Source: `backend/modules/leaveby/LeaveByApi.java`, `LeaveByApiImpl.java`, `OsrmPort.java`
- Source: `backend/modules/family/FamilyGeocodeApi.java`
- Source: `web/src/components/HeroAttentionSlide.tsx`, `AgendaInboundRequestRow.tsx`, `CarpoolSpaceRides.tsx`
- Source: `web/src/components/heroAttentionCopy.ts`, `coverageQueue.ts`
- Source: `design-tokens/tokens.json`

## Acceptance criteria

- [x] `CarpoolRide` OpenAPI schema includes nullable `pickupTown` and
      `detourMinutes`; web `api/types.ts` + client updated in the same change
- [x] `listCarpoolRides` returns `pickupTown` on other circles' rides when
      address parses; `detourMinutes` is an integer ≥ 0 for the calling adult
      when origin, pickup, event location, and OSRM all resolve
- [x] `detourMinutes` is `null` on `ownRequest` rows and when routing fails;
      list still returns 200 (soft-fail, no fake minutes)
- [x] Detour uses origin → pickup + pickup → event minus origin → event (not
      straight-line / haversine)
- [x] Integration test: stub geocode + OSRM fixtures prove detour math and
      `pickupTown` parsing on `listCarpoolRides`
- [x] `PickupLine` on hero `request` slides shows town + tone-colored minutes
      before Accept/Pass when both fields present; town-only when minutes null
- [x] `PickupLine` on expanded `AgendaInboundRequestRow` matches hero copy/tone
      (not shown during hero handoff band)
- [x] `PickupLine` on Carpool tab incoming ask rows before Accept/Pass
- [x] Tone thresholds and labels match mock (≤10 / 11–20 / ≥21)
- [x] New detour tone colors locked in `design-tokens/tokens.json` from mock hex
      (WCAG AA check on hero + list surfaces)
- [x] Component tests cover `PickupLine` tone boundaries and null/minutes-only
      cases; existing hero/inbound tests updated

## Tasks

- [x] Backend: `pickupTown` parser (pure function + unit tests)
- [x] Backend: `LeaveByApi` detour helper (batch-friendly; reuses geocode/OSRM/cache)
- [x] Backend: wire into `CarpoolRideService.list` for `otherRequests`; extend
      `CarpoolRideResponse`; add `:leaveby` module dependency
- [x] Contract: OpenAPI `pickupTown`, `detourMinutes` on `CarpoolRide`; regen
      contract test expectations
- [x] Web: `PickupLine` component + `pickupTone` helper; token roles
- [x] Web: hero slide, inbound row, Carpool tab integration; map fields in
      `coverageQueue`
- [x] Web: update `web/src/api/` types and any ride fixtures
- [x] Tests: `LeaveByApi` detour unit tests; `listCarpoolRides` integration test;
      `PickupLine` component tests; adjust `HeroAttentionCarousel` /
      `AgendaInboundRequestRow` tests

## Open questions

_None — resolved for implementation:_

- **Viewer-specific detour** on `otherRequests` only (not stored on entity).
- **Default origin** matches leave-by default, not per-event override.
- **Two-leg OSRM sum** instead of multi-waypoint route URI in this slice.
- **Town-only fallback** when routing unavailable (no fake minutes).
