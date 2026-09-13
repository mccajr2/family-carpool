# Spec: carpool-kid-split-plans

Status: draft
Parent: [docs/roadmap.md](../../roadmap.md)
Created: 2026-09-10
Updated: 2026-09-13 (`/spec` — promote)
Added: 2026-09-10 · re-rank split
Branch: `carpool-kid-split-plans`

## Problem

A family can have **multiple kids on the same team** (twins, triplets, siblings).
Default is one shared plan: all going kids, same driver, round-trip, same
location. Real life needs the same progressive treatment as legs — one tap away
from “simple,” then distinct plans per kid (including distinct per-leg plans).

Today Save ride plan and `ownRequest` / `ownLegs` are **one household-scoped kid
bag** per circle+event. Mixed “Mom drives this kid TO-only; that kid round-trips
with a teammate” cannot persist, so chips, hero gaps, and team asks stay
shared-or-nothing.

## Non-goals

- Domain four-state legs + not-going clears transport —
  [`carpool-leg-to-from`](../archive/carpool-leg-to-from.md) (prerequisite;
  keep those phases and RSVP-NO rules)
- Default collapsed DriverPicker chrome —
  [`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)
- Leg-only split editor (shared for all kids) —
  [`carpool-leg-split-plans`](../archive/carpool-leg-split-plans.md)
  (reuse disclosure + Save ride plan; do not re-implement)
- Matching-leg chip collapse rules —
  [`carpool-leg-chip-collapse`](../archive/carpool-leg-chip-collapse.md)
  (reuse within each plan group)
- True per-leg / Ask-team locations (independent Picking up from / Dropping
  off at) — [`carpool-meet-at`](../planned/carpool-meet-at.md)
- Closed PR #107 remodel (per-kid need rows as the **only** model; multi-circle
  passengers on one fulfillment) — do not revive that patch set
- Partial accept of a **multi-kid** team ask (teammate taking a subset of kids
  on one PENDING request) — still architecture out of scope; this slice avoids
  it by splitting asks when kids diverge
- Expo / push / KMP UI or `sharedLogic` OpenAPI updates
- Carpool tab visual restyle —
  [`carpool-page-redesign`](../planned/carpool-page-redesign.md)
- Coverage assign remaining orthogonal to ride plans (no new coverage coupling)

## Approach

**Web-first** progressive disclosure on the existing Focus/Hero + Agenda
expanded `DriverPicker` surfaces. Reuse driver chips + leave-from +
`coverageCopy` — do **not** fork a second coverage stack.

### Default vs split (UI)

Collapsed round-trip chrome stays the default for **all going kids together**.
No per-kid editor, chips, or copy until the adult asks.

Copy (lock, parallel to legs): **“Different plans for each kid.”** Show this
plain-text link on simple view only when the event has **2+ going** kids
(feed-linked / on the item, not RSVP NO). One going kid → omit the link.

Simple view may show both links when each is eligible:

1. **Different plans for each leg.** — existing shared-for-all-kids editor.
2. **Different plans for each kid.** — this slice (below the leg link).

Do not run both editors at once. Opening kid-split replaces simple (or
shared leg-split) chrome. Opening shared leg-split stays the current editor;
include the kid link there so the adult can jump to per-kid without going
back first. Jumping pre-fills each kid from the current shared TO/FROM
selection (or the saved shared plan).

### Kid-split editor

Activating **“Different plans for each kid.”** shows **one section per going
kid** (first name header), each a nested copy of today’s DriverPicker:

1. Default per kid: collapsed round-trip driver row (household + trailing
   Ask the team when a space exists).
2. Nested **“Different plans for each leg.”** per kid — same Getting there /
   Coming back editor already shipped (independent household / Ask / Needs
   ride per leg).
3. **One shared Leave from** combobox for the whole editor when **any** kid
   section selects a household adult. Still **not** per-kid or per-leg
   places (`carpool-meet-at`).
4. One primary **Save ride plan** applies **every** going kid in one user
   action.
5. **Back to simple view** restores collapsed shared round-trip chrome
   without forcing plans to re-merge. Confirm / Post round-trip from simple
   view still writes **one shared plan for all going kids** (merge).

Town dogfood: triplets on one team and twins on multiple teams must work
(N sections, not a hard cap of 2).

### Persistence (contract / backend)

Keep **RideRequest + two TO/FROM leg slots** as the unit. Do **not** add
`kidId` onto `RideLegSlot` as the only model, and do **not** revive PR #107
need-rows.

After kids diverge, persist **multiple active RideRequests per circle+event**,
**grouped by identical TO/FROM driver outcome** (same phase + assignee adult
/ circle per leg):

- Two twins both Ask round-trip → **one** 2-seat PENDING ask (v1 “one request
  covering attending kids” preserved when plans match).
- Mom household round-trip for kid A + Ask for kid B → **two** requests
  (PLAN/household vs PENDING ask). Teammate Accept is still empty-body on
  **that** ask only (kid B) — no partial accept of a multi-kid bag.

Invariant: a kid appears on **at most one** non-cancelled plan for
`(requesting circle, event)`. Replace today’s unique indexes that allow only
**one** active row per circle+event (`carpool_ride_requests_active_space_unique`
/ `carpool_ride_requests_active_circle_unique`).

**Save ride plan** (space-scoped and circle-local) becomes an atomic replace
of this circle’s active plans for the event: submitted groups must cover every
**going** kid (explicit `NEEDS_RIDE` on a leg is allowed). Kids moving off an
`ACCEPTED` team request: `removeKid`; empty bag → cancel that request, then
create the new group. Omit per-leg place columns.

List/detail must expose **all** of this circle’s active plans for the event
(singular `ownRequest` / event-level `ownLegs` are a lie once split). Smallest
correct OpenAPI: a list (`ownRequests` or equivalent) plus a documented rule
for the existing singular fields (keep them when there is exactly one plan;
`null` when 0 or 2+ so clients cannot pick an arbitrary bag). Bump
`info.version`; update hand-written web clients in the same change.

Locked product matrix (per going kid; combinations across kids are in scope):

| TO | FROM | Notes |
| -- | ---- | ----- |
| Household adult | Household adult (same or different) | Existing per-leg household phases |
| Household adult | Ask the team | Existing mixed-leg save |
| Ask the team | Household adult | Symmetry |
| Ask the team | Ask the team | May group with siblings who match |
| Household / Ask | Leave as Needs ride | Open leg stays a hero gap **for that kid** |

### Hero / chips / queue

Teach `transportPlan` / `transportGapKidIds` / `getQueue` / `isOwnRideGap`
that a **per-kid** in-play `NEEDS_RIDE` (or blank plan) is a gap even when
another sibling’s plan is asked or confirmed.

Collapsed chips when plans still match: **unchanged** shared chrome (no
per-kid prefix).

When plans diverge: one chip group **per distinct plan** (kid first names
joined like coverage copy), then reuse matching-leg collapse **inside** that
group. Do not render N kids × 2 legs as six chips.

`WAITING_HOUSEHOLD` confirm/decline stays assignee-scoped and must not flip
a sibling’s other plan. `clear-legs` / can’t-drive stay per-plan.

Enable carpool still attaches matching null-space PLANs — now **all** of them
for that event, not a single row.

## Context

Allowlist for `/implement`:

- Prior ships: `docs/specs/archive/carpool-leg-to-from.md` (kid bag + “persist
  in a shape that does not block per-kid”),
  `docs/specs/archive/carpool-ride-coverage-card.md`,
  `docs/specs/archive/carpool-leg-split-plans.md` (editor + Save + hero gaps;
  reuse, do not re-implement)
- Display reuse: `docs/specs/archive/carpool-leg-chip-collapse.md`
- Locations deferral: `docs/specs/planned/carpool-meet-at.md`
- Contract UX: `docs/agenda-coverage-web-contract.md` → Leave-from Focus/hero +
  expanded Agenda DriverPicker; Coverage assign / Ask the team (extend for
  kid-split editor + per-kid gaps / chips)
- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Rides / Clients / Out of scope — move per-kid distinct plans in; keep
  partial accept and per-leg locations out)
- Contract: `contracts/openapi.yaml` → ride-plans save / list events /
  `CarpoolRide` `ownRequest` / `ownLegs` (+ new list of own plans); unique
  “one active plan per event” language
- Backend: `backend/modules/carpool/.../CarpoolRideService.java`,
  `CarpoolRideRequestEntity.java`, `RideLegSlot.java`, Flyway unique indexes
  (`V26__carpool_ride_plan_nullable_space.sql` and successors), controller +
  unit / integration tests
- Web:
  - `web/src/components/DriverPicker.tsx` (+ `.test.tsx`)
  - `web/src/components/coverageCopy.ts` (+ `.test.ts`)
  - `web/src/components/LeaveFromControls.tsx`
  - `web/src/components/transportPlan.ts` (+ `.test.ts`)
  - `web/src/components/coverageQueue.ts` (+ tests)
  - `web/src/components/rideStatusChip.ts` (+ tests)
  - `web/src/components/AgendaFocusCard.tsx` / `HeroAttentionSlide` / carousel
  - `web/src/components/AgendaRow.tsx` where expanded DriverPicker mounts
  - `web/src/components/calendarRideJoin.ts`
  - `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`

Do not load `docs/roadmap.md` or whole-architecture dumps beyond the heading
above. Do not implement meet-at places or PR #107 need-rows.

## Acceptance criteria

- [ ] **“Different plans for each kid.”** appears on Focus/Hero and Agenda
      expanded uncovered own-ride DriverPicker surfaces when the event has
      **2+ going** kids; it is omitted for a single going kid.
- [ ] Activating the link shows one nested DriverPicker section per going kid
      (first-name header). Each section supports round-trip chips and nested
      **“Different plans for each leg.”** (household / Ask / Needs ride).
- [ ] Kid-split editor shows **one shared** Leave from control when any kid
      section is household; does **not** persist or show per-kid or per-leg
      place fields.
- [ ] **Save ride plan** applies every going kid atomically. Identical
      TO/FROM outcomes **group** onto one RideRequest (seats = grouped kid
      count). Divergent outcomes persist as separate requests. A kid is on
      at most one non-cancelled plan per circle+event.
- [ ] Mixed matrix works end-to-end: e.g. kid A household TO-only (FROM
      Needs ride) + kid B Ask round-trip → household PLAN (or equivalent) for
      A and a 1-seat team ask for B; teammate Accept confirms B only.
- [ ] **Back to simple view** restores collapsed shared round-trip chrome
      without merging. Confirm / Post from simple view still writes one
      shared plan for all going kids.
- [ ] OpenAPI documents the multi-plan list + Save replace semantics (version
      bump); web clients updated in the same change; **no** per-leg location
      schema; **no** PR #107-only need-row remodel.
- [ ] Unique DB indexes no longer forbid multiple active plans per
      circle+event; tests cover the kid-exclusive invariant (409/400 if a
      kid would appear on two active plans).
- [ ] `transportGapKidIds` / `getQueue` / Focus own-ride gap detection treat
      any going kid with an in-play `NEEDS_RIDE` (or blank plan) as a gap
      even when a sibling is asked or confirmed.
- [ ] Collapsed chips: shared (no per-kid prefix) while plans match; when
      they diverge, one chip group per distinct plan (names joined) with
      existing matching-leg collapse inside the group.
- [ ] RSVP NO still removes that kid (and cancels an emptied plan) without
      clearing siblings’ plans. `confirm-household` / `decline-household` /
      `clear-legs` stay scoped to the assignee’s plan(s), not every sibling.
- [ ] Circle-local `GET/POST /api/carpool/ride-plans` allows multiple PLANs
      per event; Enable attaches all matching null-space plans.
- [ ] `docs/agenda-coverage-web-contract.md` documents kid-split editor +
      grouping + per-kid gaps/chips; architecture Team carpool Rides /
      Clients / Out of scope updated (per-kid plans in; partial accept and
      locations still out).
- [ ] Backend unit + integration coverage for split/merge Save, mixed
      household+Ask, unique-index change, RSVP-NO sibling isolation;
      web tests for kid-split toggle, Save grouping, Back, and queue gap
      with two `ownRequests`. Relevant suites pass; `ModularityTests` still
      pass if backend changes.

## Tasks

- [ ] Docs: this spec; roadmap Active row; update
      `docs/agenda-coverage-web-contract.md`; architecture Team carpool
      Rides / Clients / Out of scope; note on `carpool-meet-at` stub
      (locations still owned there; point archived leg-split spec)
- [ ] Contract: OpenAPI multi-plan list + Save replace / grouping; version
      bump; web `types` + `carpoolClient`
- [ ] Backend: drop one-plan-per-event unique indexes; kid-exclusive
      invariant; atomic Save split/merge; RSVP-NO / confirm / clear scoped
      per plan; Enable attaches all PLANs; unit + integration tests
- [ ] Web: **Different plans for each kid.** link + nested per-kid
      DriverPicker (reuse leg-split); shared leave-from; Save; Back; wire
      Focus/Hero + Agenda expanded call sites; `coverageCopy` string
- [ ] Web: `transportPlan` / chips / `coverageQueue` / Focus gap helpers
      read all own plans (not singular `ownRequest` / event `ownLegs` only)
- [ ] Tests: DriverPicker / Focus / AgendaRow / transportPlan / coverageQueue
      (+ backend as above); run relevant web + carpool tests; report results

## Open questions

- Exact OpenAPI names (`ownRequests` vs wrapping `ownKidPlans`) and whether
  Save sends already-grouped `plans[]` or per-kid rows the server groups —
  implementer picks the **smallest correct** surface; do not block on
  inventing per-leg places or need-rows.
- Chip label when two plan groups exist (e.g. `{Kid} · {body}` vs coverage-
  style `{Kid} & {Kid}`) — follow existing name-join helpers; lock in PR if
  review wants different punctuation.
