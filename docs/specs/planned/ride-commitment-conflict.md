# Spec: ride-commitment-conflict

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-01  
Updated: 2026-09-01 (`/spec`)  
Added: 2026-09-01 · initial  
Branch: `ride-commitment-conflict`  
Depends on: [`auto-decline-unofferable`](../archive/auto-decline-unofferable.md), [`ride-revert-undo`](../archive/ride-revert-undo.md)  
Feeds: [`client-server-invariant-audit`](../planned/client-server-invariant-audit.md) (server fences — Phase 2)

## Problem

A circle can hold **contradictory ride commitments on the same event** without
the product noticing:

1. **Need ride + driving inbound** — the household still needs a ride for at
   least one in-play kid (`unassigned` or **Asked the team**), while an adult
   has **accepted** a teammate’s inbound ask (another family expects them to
   drive). The collapsed Agenda row shows only **Ride needed** / **Asked the
   team**; the accepted inbound commitment is buried in the expanded band.

2. **Mutual swap** — each circle has an **ACCEPTED** own request (kid riding
   with the other family) **and** has **accepted** the other family’s inbound
   ask (driving their kid). v1 allows this on the server; neither family sees
   it labeled as a two-car swap.

[`auto-decline-unofferable`](../archive/auto-decline-unofferable.md) only
auto-declines **pending** inbound asks when `ownRide === "requested"` (client
view-model). It does not withdraw **ACCEPTED** inbound, does not run when the
gap is plain **unassigned**, and does not detect mutual swaps.

Parents can forget an earlier Accept; the minimized card does not surface the
discrepancy — a real dogfood gap.

## Non-goals

- Multi-stop / one-vehicle carpooling ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Per-adult split plans (you drive inbound kid, spouse drives own kid) —
  [`coverage-leave-from`](../planned/coverage-leave-from.md) territory; this
  slice uses **circle-level** ride + gap signals only
- Confirmation dialogs before fixing conflict ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md))
- Expo / KMP
- Replacing **Overlaps** (schedule conflict) detection
- Hero carousel new slide tier in Phase 1 — use existing chips + expanded copy
  + attention dot; hero queue item is optional follow-up
- OpenAPI schema for conflict type in Phase 1 (pure client derivation)

## Approach

Two phases in one spec; **ship Phase 1 as its own PR** before server fences.

### Conflict detection (pure function)

Add `rideCommitmentConflict(rideEvent, item, coverageGames, circleId)` in
`web/src/components/` (colocate with `carpoolDisplay.ts` / `coverageQueue.ts`).

Inputs: listed `CarpoolRideEvent`, calendar `CalendarItem`, remapped
`CoverageGameEvent[]`, calling `circleId`.

**In-play only** — skip kids with attendance `not_going`.

**Type A — need ride + accepted inbound**

- `acceptedByUsRequest(rideEvent, circleId)` is non-null, **and**
- at least one in-play kid has `ownRide === "unassigned"` **or**
  `ownRide === "requested"` (use remapped games; PENDING own ask does not
  clear the gap).

**Type B — mutual swap**

- `acceptedByUsRequest` is non-null, **and**
- `rideEvent.ownRequest?.status === "ACCEPTED"` with at least one in-play kid
  on that own request’s `kidIds`, **and**
- the inbound and outbound rides involve **different** kid sets (not the same
  single-kid edge case).

Return a small struct, e.g.:

```ts
type RideCommitmentConflict =
  | { kind: "needRideAndDriving"; inbound: CarpoolRide; gapKidNames: string[] }
  | { kind: "mutualSwap"; inbound: CarpoolRide; ownRequest: CarpoolRide }
  | null
```

### Phase 1 — Surfacing (web only, no OpenAPI)

**Collapsed Agenda chips** (`rideStatusChipsForItem` / `AgendaRow` tag row):

- When conflict is non-null, insert an amber chip **after** **Overlaps** (if
  any) and **before** the own-ride chip:
  - Type A: **Also driving {firstNames}** when inbound kid names fit; else
    **Ride conflict**
  - Type B: **Ride conflict** (mint own-ride + inbound alone is insufficient)
- Do **not** drop the existing own-ride chip — show **both** conflict + gap
  state so the row is not misleading.

**Attention dot** (`agendaItemNeedsAttention`): true when conflict is
non-null (same tier as remaining gap / Overlaps).

**Focus card** (`AgendaFocusCard`): when the focused item has a conflict,
show one factual amber line under chips (no dialog):

- Type A: **You're driving {inbound summary} but {gap names} still need a
  ride.**
- Type B: **You're driving {their kid} and {your kid} rides with them — pick
  one plan.**

Reuse existing reverse actions (**Can't take them anymore**, **Cancel this
ask**, **Find a new ride**) — no new API.

**Expanded Agenda band**: optional one-line callout above inbound + kid rows
when conflict is set (same copy as Focus).

**Week glance / `getQueue`**: no new queue tier in Phase 1; conflict drives
attention dot + chips only.

**Contract:** none. Derive from existing `listCarpoolRides` + calendar list.

### Phase 2 — Server enforcement (follow-up PR)

Rank for [`client-server-invariant-audit`](../planned/client-server-invariant-audit.md).
Single-action side effects per [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md):

| Mutation | Side effect when conflict would be created |
| -------- | ---------------------------------------- |
| `POST …/rides` (create) | **Auto-withdraw** any ACCEPTED inbound on same `(spaceId, eventKey)` for caller’s circle before or as part of create; OR **409** if withdraw fails |
| `POST …/rides/{id}/accept` | **409** when caller circle has remaining gap kids on that event **or** active own `PENDING`/`ACCEPTED` request on that event |
| Extend create | **409** when caller already has ACCEPTED inbound on that event and create would add Type A (belt-and-suspenders after withdraw rule) |

Document chosen rules in audit punch-list. Integration tests in carpool module.

Phase 2 is **not** required to close Phase 1 AC.

## Context

- Decision: [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)
- Contract: [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md) — collapsed tag precedence
- Archived: [`auto-decline-unofferable`](../archive/auto-decline-unofferable.md), [`ride-revert-undo`](../archive/ride-revert-undo.md), [`carpool-ride-clarity`](../archive/carpool-ride-clarity.md)
- Source: `web/src/components/carpoolDisplay.ts` — `acceptedByUsRequest`, `agendaOwnRideStatusChip`
- Source: `web/src/components/coverageQueue.ts` — `mapOwnRideStatusForKid`, `remainingCoverageGapKidIds`, `isUnassigned`
- Source: `web/src/components/rideStatusChip.ts` — `rideStatusChipsForItem`, `pickMostUrgentGameRow`
- Source: `web/src/components/coverageDisplay.ts` — `agendaItemNeedsAttention`, `insertOwnRideStatusChip`
- Source: `web/src/components/AgendaRow.tsx`, `AgendaFocusCard.tsx`
- Source: `backend/modules/carpool/internal/CarpoolRideService.java` — Phase 2 only

## Acceptance criteria

### Phase 1 (web)

- [ ] Pure helper returns Type A when ACCEPTED inbound coexists with an
      in-play kid `unassigned` or `"requested"` on the same event
- [ ] Pure helper returns Type B for mutual ACCEPTED swap (both directions)
- [ ] Pure helper returns null when only one direction is set and gaps are
      cleared (e.g. kid **Riding with** teammate, no inbound accept)
- [ ] Collapsed Agenda shows amber **Ride conflict** or **Also driving …**
      chip alongside the gap chip — not instead of it
- [ ] Collapsed attention dot fires when conflict is present
- [ ] Focus card shows factual conflict line with both commitments named
- [ ] Expanded row still exposes **Can't take them anymore** / cancel ask /
      find new ride without new dialogs
- [ ] Unit tests for helper + chip/attention/Focus copy; extend
      `AgendaRow.test.tsx` / `AgendaFocusCard.test.tsx` for Type A and B fixtures

### Phase 2 (backend — follow-up)

- [ ] Create ride auto-withdraws or blocks ACCEPTED inbound on same event
- [ ] Accept ride returns **409** when accepter has gap or active own request
      on same event
- [ ] Integration tests; entry added to client-server-invariant-audit punch-list

## Tasks

### Phase 1

- [ ] Web: `rideCommitmentConflict` helper + unit tests
- [ ] Web: wire conflict chip into `rideStatusChipsForItem` / `AgendaRow`
- [ ] Web: `agendaItemNeedsAttention` + Focus conflict line
- [ ] Web: optional expanded-row callout
- [ ] Tests: Type A/B fixtures in row + Focus tests

### Phase 2 (separate PR after Phase 1)

- [ ] Backend: enforce on `create` / `accept` in `CarpoolRideService`
- [ ] Backend: unit + integration tests
- [ ] Docs: update `client-server-invariant-audit` punch-list

## Open questions

- **Phase 1 chip copy:** prefer single **Ride conflict** label for both types,
  or Type A **Also driving {names}**? Locked for implement: Type A uses **Also
  driving {first inbound kid name}** when one kid; plural or **Ride conflict**
  when multiple inbound names.
- **Household coverage edge case:** kid with CONFIRMED household driver (`You`
  driving via coverage) + ACCEPTED inbound for teammate kid — valid two-kid
  plan. Phase 1 helper must **not** flag Type A when every gap kid has
  `isConfirmedDriver(ownRide)` from household coverage (not teammate ride).
  Resolve in helper tests with a CONFIRMED coverage fixture.
- **Hero queue:** defer adding a dedicated carousel slide unless dogfood asks
  for it after Phase 1 chips ship.
