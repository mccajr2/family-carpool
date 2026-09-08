# Spec: ride-commitment-conflict

Status: archived  
Completed: 2026-09-06  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-01  
Updated: 2026-09-06 (`/pr`)  
Added: 2026-09-01 · initial  
Branch: `ride-commitment-conflict`  
Depends on: [`auto-decline-unofferable`](auto-decline-unofferable.md), [`ride-revert-undo`](ride-revert-undo.md)  
Feeds: [`client-server-invariant-audit`](../planned/client-server-invariant-audit.md) (server fences — separate PR)

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

[`auto-decline-unofferable`](auto-decline-unofferable.md) only
auto-declines **pending** inbound asks when `ownRide === "requested"` (client
view-model). It does not withdraw **ACCEPTED** inbound, does not run when the
gap is plain **unassigned**, and does not detect mutual swaps.

Parents can forget an earlier Accept; the minimized card does not surface the
discrepancy — a real dogfood gap.

## Non-goals

- **Server fences** (409 / auto-withdraw on create or accept) — punch-list
  under [`client-server-invariant-audit`](../planned/client-server-invariant-audit.md);
  not required to close this PR
- Multi-stop / confirmed-ride Route detail
  ([`ride-route-tab`](../active/ride-route-tab.md) and siblings)
- Per-adult split plans (you drive inbound kid, spouse drives own kid) —
  [`coverage-leave-from`](../planned/coverage-leave-from.md) territory; this
  slice uses **circle-level** ride + gap signals only
- Confirmation dialogs before fixing conflict
  ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md))
- Expo / KMP
- Replacing **Overlaps** (schedule conflict) detection
- New hero carousel slide tier — attention dot + chips + Focus line only
- OpenAPI / contract schema for conflict type (pure client derivation)
- Week glance / `getQueue` new priority tier

## Approach

**Phase 1 only (this PR):** pure client detection + Agenda surfacing. No
OpenAPI changes. Reuse existing reverse actions (**Can't take them anymore**,
**Cancel this ask**, **Find a new ride**) — no new API.

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

**Not Type A:** every remaining gap kid has household `isConfirmedDriver(ownRide)`
(CONFIRMED coverage “You” driving) while ACCEPTED inbound covers a teammate
kid — that is a valid two-kid plan. Helper must return null for that fixture.

Return a small struct, e.g.:

```ts
type RideCommitmentConflict =
  | { kind: "needRideAndDriving"; inbound: CarpoolRide; gapKidNames: string[] }
  | { kind: "mutualSwap"; inbound: CarpoolRide; ownRequest: CarpoolRide }
  | null
```

### Surfacing (web)

**Collapsed Agenda chips** (`rideStatusChipsForItem` / `AgendaRow` tag row):

- When conflict is non-null, insert an amber chip **after** **Overlaps** (if
  any) and **before** the own-ride chip:
  - Type A: **Also driving {first inbound kid first-name}** when exactly one
    inbound kid name; else **Ride conflict**
  - Type B: **Ride conflict**
- Do **not** drop the existing own-ride / gap chip — show **both** conflict +
  gap (or riding-with) state so the row is not misleading.
- Presentation stays Feeds-aligned uppercase chips (`AgendaStatusChip`);
  helper labels stay Title Case.

**Attention dot** (`agendaItemNeedsAttention`): true when conflict is
non-null (same tier as remaining gap / Overlaps).

**Focus card** (`AgendaFocusCard`): when the focused item has a conflict,
show one factual amber line under chips (no dialog):

- Type A: **You're driving {inbound summary} but {gap names} still need a
  ride.**
- Type B: **You're driving {their kid} and {your kid} rides with them — pick
  one plan.**

**Expanded Agenda band**: one-line callout above inbound + kid rows when
conflict is set (same copy as Focus).

Update collapsed-tag precedence note in
`docs/agenda-coverage-web-contract.md` to include the conflict chip slot
(`Overlaps` → conflict → own-ride → …).

## Context

- Decision: [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)
- Contract: [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md) — **Collapsed status tags** precedence
- Archived: [`auto-decline-unofferable`](auto-decline-unofferable.md), [`ride-revert-undo`](ride-revert-undo.md), [`carpool-ride-clarity`](carpool-ride-clarity.md), [`agenda-ride-rider-chips`](agenda-ride-rider-chips.md)
- Source: `web/src/components/carpoolDisplay.ts` — `acceptedByUsRequest`, `agendaOwnRideStatusChip`
- Source: `web/src/components/coverageQueue.ts` — `mapOwnRideStatusForKid`, `remainingCoverageGapKidIds`, `isUnassigned`, `isConfirmedDriver`
- Source: `web/src/components/rideStatusChip.ts` — `rideStatusChipsForItem`, `pickMostUrgentGameRow`
- Source: `web/src/components/coverageDisplay.ts` — `agendaItemNeedsAttention`, `insertOwnRideStatusChip`
- Source: `web/src/components/AgendaRow.tsx`, `AgendaFocusCard.tsx`
- Tests: `web/src/components/rideStatusChip.test.ts`, `coverageDisplay.test.ts`, `AgendaRow.test.tsx`, `AgendaFocusCard.test.tsx`

## Acceptance criteria

- [x] Pure helper returns Type A when ACCEPTED inbound coexists with an
      in-play kid `unassigned` or `"requested"` on the same event
- [x] Pure helper returns Type B for mutual ACCEPTED swap (both directions,
      different kid sets)
- [x] Pure helper returns null when only one direction is set and gaps are
      cleared (e.g. kid **Riding with** teammate, no inbound accept)
- [x] Pure helper returns null when ACCEPTED inbound coexists with household
      CONFIRMED coverage for every own gap kid (valid two-kid plan)
- [x] Collapsed Agenda shows amber **Also driving {name}** (single inbound
      kid) or **Ride conflict** (Type A multi / Type B) **after Overlaps and
      before** the own-ride chip, alongside the gap / riding-with chip — not
      instead of it
- [x] Collapsed attention dot fires when conflict is present
- [x] Focus card shows factual conflict line with both commitments named
- [x] Expanded row shows the same one-line conflict callout and still exposes
      **Can't take them anymore** / cancel ask / find new ride without new
      dialogs
- [x] `docs/agenda-coverage-web-contract.md` collapsed-tag precedence lists
      the conflict chip slot
- [x] Unit tests for helper + chip/attention/Focus copy; Type A and B
      fixtures in `AgendaRow.test.tsx` / `AgendaFocusCard.test.tsx`

## Tasks

- [x] Web: `rideCommitmentConflict` helper + unit tests (Type A, Type B, null
      cases, CONFIRMED-coverage non-conflict)
- [x] Web: wire conflict chip into `rideStatusChipsForItem` /
      `insertOwnRideStatusChip` / `AgendaRow` (order: Overlaps → conflict →
      own-ride)
- [x] Web: `agendaItemNeedsAttention` true when conflict non-null
- [x] Web: Focus conflict line + expanded-row callout (shared copy helper)
- [x] Docs: update collapsed-tag precedence in
      `docs/agenda-coverage-web-contract.md`
- [x] Tests: Type A/B fixtures in `AgendaRow.test.tsx` /
      `AgendaFocusCard.test.tsx`; extend chip/attention unit tests

## Open questions

_None blocking._ Chip copy and household CONFIRMED edge case locked above.
Hero carousel slide deferred unless dogfood asks after chips ship. Server
fences stay under `client-server-invariant-audit`.
