# Spec: carpool-leg-split-plans

Status: archived  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Updated: 2026-09-11 (`/pr` — archive after ship)  
Added: 2026-09-10 · re-rank split  
Branch: `carpool-leg-split-plans`

## Problem

Round-trip is the default coverage path, but families often need **different
drivers** for Getting there vs Coming back (e.g. you drive TO, ask the team on
FROM). That complexity must stay one tap away via **“Different plans for each
leg.”** — never inline by default.

Today the link is inert
([`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)).
Worse: `getQueue` / Focus gap CTAs still key off rollup `ownRide` (household
coverage + whole-request PENDING/ACCEPTED), **not** per-leg `NEEDS_RIDE`. Once
legs can diverge, a cancelled or one-leg-only plan can leave a real gap that
never re-enters the hero while coverage still looks “covered.”

## Non-goals

- **True per-leg locations** (independent **Picking up from** / **Dropping off
  at** persistence on each leg slot; Ask-team meet-at / radius) —
  [`carpool-meet-at`](../planned/carpool-meet-at.md) (this slice keeps
  **ride-level** leave-from / requester-house pickup)
- Matching-leg chip collapse (plain / round-trip status when TO/FROM match) —
  [`carpool-leg-chip-collapse`](carpool-leg-chip-collapse.md)
  (display-only; soft dependency — dual chips from
  [`carpool-leg-to-from`](carpool-leg-to-from.md) already show
  diverge)
- Per-kid progressive split —
  [`carpool-kid-split-plans`](../planned/carpool-kid-split-plans.md)
- Default collapsed DriverPicker chrome redesign —
  already shipped in
  [`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)
- Changing ADR-0001 event-group order beyond teaching own-ride gaps about
  per-leg `NEEDS_RIDE`
- Expo / push / KMP UI
- Carpool tab visual restyle —
  [`carpool-page-redesign`](../planned/carpool-page-redesign.md)

## Approach

**Web-first** progressive disclosure on the existing Focus/Hero + Agenda
expanded `DriverPicker` surfaces. Reuse driver chips + leave-from +
`coverageCopy` — do **not** fork a second coverage stack.

### Split editor (UI)

Activating **“Different plans for each leg.”** replaces the collapsed
round-trip form with:

1. **Getting there** section — independent driver row (household adults +
   trailing **Ask the team**), same chip rules as default.
2. **Coming back** section — same, independently selected.
3. **One shared Leave from** combobox when **either** leg selects a household
   adult (same `LeaveFromControls` / one-time option as today). Do **not**
   render two independent place fields in this PR.
4. Primary button: **Save ride plan** (applies **both** legs in one user
   action).
5. **Back to simple view** — returns to the collapsed round-trip DriverPicker
   chrome without forcing legs to re-sync; user can still Confirm / Post
   round-trip from simple view as today.

Default collapsed Confirm / Post round-trip paths stay unchanged when the
editor is closed.

### Writes (contract / backend — expected)

Single-leg **Ask the team** already exists (`createCarpoolRide` optional
`legs`). Household coverage assign is still **orthogonal** to leg slots;
`WAITING_HOUSEHOLD` is modeled but not written by today’s Confirm / Assign
path.

**This PR must** persist independent **driver** outcomes onto the existing
TO/FROM leg slots (phases + assignee identity) so mixed plans are truthful in
`ownLegs` / chips / cancel rules. Prefer the **smallest** OpenAPI surface that
lets Save ride plan apply both legs atomically (or a short documented compose
of existing endpoints if that stays correct under concurrent cancel). Bump
`info.version`; update hand-written web clients in the same change. **No**
per-leg place columns — leave-from stays ride/coverage-level; ask pickup stays
requester house.

Locked product matrix for dogfood (shared plan for all **going** kids):

| TO | FROM | Notes |
| -- | ---- | ----- |
| Household adult | Household adult (same or different) | Phases WAITING_HOUSEHOLD or CONFIRMED per self vs other |
| Household adult | Ask the team | Ask creates/updates FROM only (or remaining open ask leg) |
| Ask the team | Household adult | Symmetry |
| Ask the team | Ask the team | Equivalent to today’s round-trip Post (may stay on simple path) |
| Household / Ask | Leave as Needs ride | Allowed — the open leg must re-enter the hero queue |

Combined cancel when both legs share the same assignee adult remains owned by
`carpool-leg-to-from` (driver identity only).

### Hero / Focus queue (must ship with the editor)

Teach `getQueue` / `isOwnRideGap` (and Focus CTAs that mirror gap detection)
about **per-leg** gaps: when `ownLegs` has any in-play leg in `NEEDS_RIDE`
(or equivalent “still needs a decision”), the event remains an own-ride queue
item even if rollup `ownRide` looks covered / requested / confirmed on the
other leg. Do not drop mixed-plan gaps from the carousel.

## Context

Allowlist for `/implement`:

- Prior ships: `docs/specs/archive/carpool-leg-to-from.md`,
  `docs/specs/archive/carpool-ride-coverage-card.md`
- Soft display follow-on: `docs/specs/archive/carpool-leg-chip-collapse.md`
  (shipped early in this PR; do not re-implement)
- Locations / meet-at deferral: `docs/specs/planned/carpool-meet-at.md`
- Contract UX: `docs/agenda-coverage-web-contract.md` → Leave-from Focus/hero +
  expanded Agenda DriverPicker; Coverage assign / Ask the team (extend for
  split editor + Save ride plan)
- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Rides / Clients / Out of scope — move per-leg **driver** split in; keep
  per-leg **locations** / meet-at out → `carpool-meet-at`)
- Decision: `docs/decisions/ADR-0001-coverage-priority-rule.md` (queue
  ordering; only gap *detection* changes)
- Contract: `contracts/openapi.yaml` → carpool rides create / legs / ownLegs
  (+ any new save-plan or household-leg write)
- Backend: `backend/modules/carpool/.../CarpoolRideService.java`,
  `CarpoolRideRequestEntity.java`, `RideLegSlot.java`, controller + unit /
  integration tests
- Web:
  - `web/src/components/DriverPicker.tsx` (+ `.test.tsx`)
  - `web/src/components/coverageCopy.ts` (+ `.test.ts`)
  - `web/src/components/LeaveFromControls.tsx`
  - `web/src/components/coverageQueue.ts` (+ tests)
  - `web/src/components/AgendaFocusCard.tsx` / `HeroAttentionSlide` / carousel
  - `web/src/components/AgendaRow.tsx` where expanded DriverPicker mounts
  - `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`
  - `web/src/components/rideStatusChip.ts` only if gap/chip helpers need shared
    leg-open detection

Do not load `docs/roadmap.md` or whole-architecture dumps beyond the heading
above. Do not implement meet-at places or per-kid split.

## Acceptance criteria

- [x] **“Different plans for each leg.”** on Focus/Hero and Agenda expanded
      uncovered own-ride DriverPicker surfaces activates a split editor
      (Getting there / Coming back) with independent driver selection per leg
      (household chips + Ask the team).
- [x] Split editor shows **one shared** Leave from control when any selected
      leg is household; does **not** persist or show independent per-leg
      place fields.
- [x] **Save ride plan** applies both legs so resulting `ownLegs` (or
      equivalent list payload) reflect the chosen phases/assignees; mixed
      household + Ask combinations from the Approach matrix work end-to-end.
- [x] **Back to simple view** restores collapsed round-trip DriverPicker chrome;
      round-trip Confirm / Post from simple view still work.
- [x] OpenAPI documents whatever write surface Save ride plan needs (version
      bump); web clients updated in the same change; **no** per-leg location
      schema.
- [x] `getQueue` / Focus own-ride gap detection treats an in-play leg in
      `NEEDS_RIDE` as a gap even when the other leg is asked or confirmed —
      cancelled/withdrawn teammate leg (or intentional one-leg plan) re-enters
      the hero.
- [x] `docs/agenda-coverage-web-contract.md` documents split editor + Save ride
      plan + queue per-leg gap rule; architecture Team carpool Rides / Out of
      scope updated (drivers in; locations still meet-at).
- [x] Backend unit + integration coverage for mixed-leg save / single-leg ask +
      household combinations; web tests for editor toggle, Save, Back, and
      queue gap with divergent `ownLegs`. Relevant suites pass;
      `ModularityTests` still pass if backend changes.

## Tasks

- [x] Docs: this spec; roadmap Active row; update
      `docs/agenda-coverage-web-contract.md`; architecture Team carpool
      Rides / Out of scope; note on `carpool-meet-at` stub (locations owned there)
- [x] Contract: smallest OpenAPI write for Save ride plan / household per-leg
      phases + version bump; web `types` + `carpoolClient`
- [x] Backend: persist independent driver outcomes on TO/FROM slots; compose or
      atomic save; unit + integration tests (mixed matrix + cancel rules unchanged)
- [x] Web: activate Different plans link → split editor in `DriverPicker` (or
      thin wrapper); shared leave-from; Save ride plan; Back to simple view;
      wire Focus/Hero + Agenda expanded call sites; `coverageCopy` strings
- [x] Web: teach `coverageQueue` / Focus gap helpers about per-leg `NEEDS_RIDE`
- [x] Tests: DriverPicker / Focus / AgendaRow / coverageQueue (+ backend as
      above); run relevant web + carpool tests; report results

## Open questions

- Soft dependency: `carpool-leg-chip-collapse` (merged on `main` first) —
  `collapseMatchingLegChips` reuses plain unprefixed matching bodies; matching
  legs after a round-trip save collapse per that id’s rules.
- Exact OpenAPI shape (new `saveRidePlan` vs extend create/coverage) is left to
  implementer under “smallest correct surface” — resolve in PR if review
  prefers one style; do not block on inventing per-leg places.

## Dogfood follow-ups (locked in this PR)

Smoke-test fixes shipped with this slice (same PR):

1. **Family-only split** — “Different plans” works for 2+ adults without Enable
   carpool; Ask stays space-gated; circle-local `PLAN` (`space_id` null) via
   `GET/POST /api/carpool/ride-plans`; Enable attaches those plans to the new
   space.
2. **Waiting-on-you confirm** — `WAITING_HOUSEHOLD` assigned to the viewer is a
   Hero/Agenda Confirm decision (`confirm-household` / `decline-household`);
   chip body **Confirm you'll drive**; does not rewrite pickup or Ask legs.
3. **RSVP NO clears waiting household** — `cancelLegs` resets
   `WAITING_HOUSEHOLD`; last kid → both legs `NEEDS_RIDE` / `CANCELLED` so
   going again does not resurrect the plan.
4. **Settled driver + one-leg inbound** — confirmed household driver who
   accepted a FROM-only (or TO-only) ask shows dual Getting there / Coming back
   chips with `· +n` only on confirmed inbound legs — not `You're driving · +n`
   as an unspecified round-trip.

5. **Dogfood batch 2** — shared `transportPlan` helper: non-blank settled
   `ownLegs` win over `uncoveredKidIds` (no false Needs coverage / Request);
   per-assignee can't-drive links + `clear-legs` (PLAN / circle-local); Request
   only when a gap remains; matching-chip collapse to plain unprefixed body; inbound
   `· +n` on every household path; FROM-only Drop off + leg-scoped withdraw;
   hero pending title `{Assigner} assigned you to drive {Kid}`.
