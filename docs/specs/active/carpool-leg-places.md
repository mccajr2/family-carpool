# Spec: carpool-leg-places

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-09-14 · re-rank split  
Branch: `carpool-leg-places`  
Updated: 2026-09-14 · amend Default = My default leave-from primary, first-located fallback only

## Problem

Getting there and Coming back often use **different family-side places**
(e.g. leave Grandma’s for practice, return to Home). Drivers and teammates
need those places on the **leg**, not a single ride-level requester-house
snapshot plus one shared Leave from.

Today Save ride plan / create ask still snapshot **one** pickup (requester
house) and the split / kid-split editors keep **one shared Leave from** when
any selected leg is household
([`carpool-leg-split-plans`](../archive/carpool-leg-split-plans.md),
[`carpool-kid-split-plans`](../archive/carpool-kid-split-plans.md)). OpenAPI
explicitly omits per-leg place fields. Until legs own places, Route, inbound
pickup copy, and later meet-at / day-block work stay stuck on a single origin.

## Non-goals

- Ask-the-team **meet-at sub-flow** (pickup-at-home vs drop-at-teammate /
  radius / distance match) — [`carpool-meet-at`](../planned/carpool-meet-at.md)
  (Ask the team stays undifferentiated on this PR; it **may** post using the
  chosen TO pickup place instead of always membership home)
- Early/late windows — `carpool-early-late-window`
- Stop-order optimize — `carpool-route-optimize`
- Driving blocks — `day-block-domain` / agenda / route (depend on this ship)
- Live navigation or in-app maps
- Least-privilege address hiding — parked `carpool-least-privilege` (accept
  current pickup-address visibility to space members)
- Inventing a second address model (reuse circle **named places** + existing
  one-time free-text)
- Changing per-leg **driver** phases, kid-split grouping, or hero gap rules
- Expo / push / KMP UI (`sharedLogic` stays frozen)

## Approach

**Web-first** OpenAPI + carpool persistence + DriverPicker editors. Reuse
`LeaveFromControls` modes (Default / named located place / one-time) — do not
fork a second place picker.

### Family-side place per leg (locked)

Each TO / FROM leg stores **one** family-side place using the same mutually
exclusive modes as coverage leave-from:

| Mode | Stored |
| ---- | ------ |
| **Default** | Resolve at write/serve in this order: (1) signed-in adult’s **My default leave-from** (`membership.defaultLeaveFromPlaceId` / Places chooser) when set and usable (located / has address); (2) else first located place by name — same fallback leave-by uses when no membership default. Both place id and one-time address null on the leg. If neither resolves, Ask **400**. |
| **Named place** | Located circle `placeId` |
| **One-time** | Free-text address (never creates a Place) |

Labels (product copy):

- **TO** → **Picking up from**
- **FROM** → **Dropping off at**

The other end of each leg remains the **event venue** (calendar item
location) — do not persist venue as a leg place in this PR.

### Ride-level pickup snapshot

Keep `pickupPlaceName` / `pickupAddress` on the ride for Accept / inbound /
Route stop chrome. On create / Save, set them from the **TO** family-side
place (resolved name + address). FROM place is exposed on the FROM leg only
(list/detail). Confirm / decline / clear-legs still do not rewrite places
unless Save replaces the plan.

### Editors (web)

1. **Simple round-trip** — one **Leave from** combobox (today’s chrome). On
   Confirm / Post / Save that writes both legs, apply that place to **both**
   TO pickup and FROM drop-off. Household Confirm still commits calendar
   coverage leave-from as today (orthogonal).
2. **Shared leg-split** — replace the single shared Leave from with:
   - **Picking up from** under Getting there when that leg is household or
     Ask the team
   - **Dropping off at** under Coming back when that leg is household or Ask
   - Omit the place control for a leg left as open **Needs ride**
3. **Kid-split** — same per-leg place controls **inside each kid section**
   (or nested leg-split); no longer one Leave from for the whole editor.
   Places participate in identical-outcome grouping: two kids group only when
   TO/FROM **driver outcomes and family-side places** match.
4. Primary **Save ride plan** sends per-leg place fields on each group’s
   legs. Ask without a resolvable TO pickup address still **400**.

### Persistence / modules

- Flyway: place columns on leg slots (or equivalent JSON on the request row —
  prefer columns on the existing leg model). Snapshot name+address at write
  for teammate-visible display (same spirit as today’s pickup snapshot).
- `CarpoolRideService` Save / create / list / detail read+write the new
  fields; migrate existing rows: both legs Default (serve resolves via
  **My default leave-from**, then first-located-by-name fallback).
- Route stop building: TO pickup stop uses TO place; FROM drop-off stop uses
  FROM place when present (fallback to ride-level pickup / home for old
  rows).

### Contract

OpenAPI version bump in the same change as web clients:

- Extend `CarpoolRideLeg` (and list/detail own request legs) with family-side
  place fields (place id / name / address or equivalent mode triad).
- Extend `SaveCarpoolRidePlanLeg` (and create-ask path if it shares the leg
  write) so Save can set per-leg places. Document that ride-level pickup is
  derived from TO.
- Update `docs/agenda-coverage-web-contract.md` shared Leave from bullets to
  the per-leg controls above.
- Update `docs/architecture.md` Team carpool **Rides** / **Out of scope**:
  per-leg places in; meet-at sub-flow still → `carpool-meet-at`.

## Context

Allowlist for `/implement`:

- Deferred ownership / problem sketch: prior notes lived under
  `docs/specs/planned/carpool-meet-at.md` (now narrowed); reuse decisions in
  [`docs/specs/archive/carpool-leg-split-plans.md`](../archive/carpool-leg-split-plans.md)
  (shared Leave from deferral) and
  [`docs/specs/archive/carpool-kid-split-plans.md`](../archive/carpool-kid-split-plans.md)
  (locations still out there)
- Origin modes (named / one-time triad): [`docs/specs/archive/coverage-leave-from.md`](../archive/coverage-leave-from.md)
  → Origin modes (locked). Leg **Default** primary = membership **My default
  leave-from**; first-located-by-name only when that cannot resolve
- Membership default: `docs/architecture.md` → Family circle writes / default
  leave-from; Places UI **My default leave-from**;
  `PATCH /api/family/circle/default-leave-from`
- Web contract: `docs/agenda-coverage-web-contract.md` → DriverPicker /
  shared Leave from / leg-split / kid-split place bullets
- Architecture: `docs/architecture.md` → Team carpool **Rides** / **Out of
  scope**; Family circle **Place**
- Contract: `contracts/openapi.yaml` → `CarpoolRideLeg`,
  `SaveCarpoolRidePlanGroup` / `SaveCarpoolRidePlanLeg`, ride
  `pickupPlaceName` / `pickupAddress`
- Source: `backend/modules/carpool/.../CarpoolRideService.java`,
  ride request / leg entity + Flyway; `web/src/components/DriverPicker.tsx`,
  `LeaveFromControls` (or equivalent), `FamilyScreen` / Agenda Focus save
  paths; `web/src/api/carpoolClient.ts` + `types.ts`

## Acceptance criteria

- [ ] Save ride plan (space-scoped and circle-local) persists independent
      family-side places on TO and FROM; re-GET list/detail returns them on
      legs.
- [ ] Simple round-trip Confirm / Post / Save with one Leave from writes the
      **same** resolved place to both TO pickup and FROM drop-off.
- [ ] Shared leg-split editor shows **Picking up from** (TO) and **Dropping
      off at** (FROM) independently when those legs need a place; Save keeps
      them distinct across a reload.
- [ ] Kid-split editor no longer uses one shared Leave from for all kids;
      per-kid / per-leg places save correctly; kids group only when driver
      outcomes **and** places match.
- [ ] Ride-level `pickupPlaceName` / `pickupAddress` equal the resolved TO
      place after Save / create ask; Ask with no resolvable TO pickup
      (Default with neither membership default nor first-located place)
      still returns **400**.
- [ ] Existing plans without leg place columns serve as Default
      (**My default leave-from** first, then first-located-by-name fallback)
      without migration failure.
- [ ] OpenAPI documents the new leg place fields + Save body; web API
      clients updated in the same change; KMP `sharedLogic` untouched.
- [ ] Agenda coverage web contract + architecture Team carpool Rides / Out
      of scope updated (per-leg places in; meet-at still out).
- [ ] Unit + integration tests cover Save/read of diverging TO/FROM places
      and the shared-simple → both-legs write; web component tests cover
      split / kid-split place controls (would fail if places were ignored).

## Tasks

- [x] Backend: Flyway leg place columns (or equivalent); entity + service
      Save/create/list/detail; derive ride pickup from TO; Default =
      membership default leave-from, then first-located-by-name fallback;
      Route stop uses TO/FROM places
- [ ] Contract: OpenAPI leg + Save place fields; version bump; document
      pickup derivation and Ask **400** without TO pickup
- [ ] Web: `carpoolClient` / types; DriverPicker simple shared Leave from →
      both legs; split + kid-split per-leg place controls; grouping includes
      places
- [ ] Docs: `agenda-coverage-web-contract.md` place bullets;
      `architecture.md` Rides / Out of scope
- [ ] Tests: `CarpoolRideServiceTest` + controller integration (diverging
      places, simple both-legs, Ask missing pickup); DriverPicker /
      FamilyScreen (or Agenda) component tests for split + kid-split places

## Open questions

- None blocking. Teammate-visible addresses remain as today until parked
  `carpool-least-privilege`; accepted risk for this dogfood slice.
