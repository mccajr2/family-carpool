# Spec: auto-decline-unofferable

Status: draft  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `auto-decline-unofferable`  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`ride-revert-undo`](../archive/ride-revert-undo.md)  
Governs: [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)  
Supersedes: [`assign-cancels-carpool-request`](../planned/assign-cancels-carpool-request.md) (cancelled — both ask-team and assign→cancel-own-ask paths)

## Problem

A parent can still leave contradictory ride state on Agenda: **Ask the team**
while inbound teammate asks stay Accept/Pass-able, or **Assign** a household
driver while an open outbound team ask stays live. Both mean offering (or
appearing to offer) a ride they do not have secured — or keeping a team ask
after coverage is already solved in-house.

[`coverage-priority-engine`](../archive/coverage-priority-engine.md) already
ships the pure `autoDeclineUnofferable` transform; [`ride-revert-undo`](../archive/ride-revert-undo.md)
ships Reconsider UI gated on `canOffer` + `autoDeclined`. Neither wires the
invariant into live mutations.

## Non-goals

- Pre-action warning paragraph before **Ask the team** (deliberately cut from
  the mock)
- Broadening auto-decline of inbound asks to plain `"unassigned"` or pending
  household confirm — trigger stays **`ownRide === "requested"` only**
- Persisting `autoDeclined` on the server / OpenAPI (session-client flag, same
  pattern as `recentlyWithdrawnRideIds`)
- Hard-declining inbound rides via a new API — keep them `PENDING`; UI treats
  them as auto-declined until Reconsider/Accept
- Confirmation dialogs on Assign→cancel-own-ask ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)
  — one action, no dialog)
- iOS / Expo
- Copy/a11y polish pass ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))

## Approach

Mirror the mock’s central enforcement
([`carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx)
`setGames` → `autoDeclineUnofferable`): every path that updates coverage/ride
view state must leave the invariant true, not re-check it ad hoc in each
button handler.

### 1. Auto-decline inbound when own ride is `"requested"`

After calendar + carpool rides remap to `CoverageGameEvent[]`, run
`autoDeclineUnofferable` (or equivalent merge) so pending inbound
`CarpoolRequest`s on that game become `status: "declined"` +
`autoDeclined: true` in the **view-model**.

Because OpenAPI rides stay `PENDING`, also keep a **session Set** of
auto-declined ride ids (parallel to `recentlyWithdrawnRideIds` in
`FamilyScreen`):

- **Add** ids when `autoDeclineUnofferable` marks them (Ask the team /
  reload while own ride is still `"requested"`).
- **Keep** ids after own ride leaves `"requested"` so
  [`AgendaInboundRequestRow`](../../../web/src/components/AgendaInboundRequestRow.tsx)
  can show **Declined — you needed a ride too** + **Reconsider** when
  `canOffer` (already implemented).
- **Clear** an id on successful Accept/Reconsider (and on full calendar
  logout/reset as with the withdraw set).

Pass `autoDeclined={…}` into every `AgendaInboundRequestRow` (Agenda list;
hero handoff already skips Accept when the ask is in the carousel — ensure
auto-declined asks are **not** treated as actionable queue items via existing
`pendingRequests` / chip helpers that already honor `autoDeclined`).

### 2. Assign cancels open outbound team ask

When `onAssignCoverage` succeeds for kids who are covered by a **PENDING**
`ownRequest` on that event, **cancel that ride** with the existing
`cancelRide` client (same as cancel-team-ask), **no dialog**. Refresh
calendar + rides afterward so chips / queue drop **Asked the team**.

Scope: any household Assign that solves coverage for kids on an open own
ask — not only self-confirm. If the PENDING ask’s `kidIds` intersect the
assigned `kidIds`, cancel it (v1 asks are one ride covering the needing
kids).

### Contract

**No OpenAPI changes.** Reuse `createRide`, `cancelRide`, `acceptRide`.
`autoDeclined` remains a client view-model / session flag.

## Context

- Decision: [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)
- Prior slices: [`coverage-priority-engine`](../archive/coverage-priority-engine.md)
  (`autoDeclineUnofferable`), [`ride-revert-undo`](../archive/ride-revert-undo.md)
  (Reconsider / `autoDeclined` prop on inbound rows)
- Visual: [`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx)
  → `autoDeclineUnofferable`, `setGames` wrapper, RequestRow chip
  **Declined — you needed a ride too**
- Source: `web/src/components/coverageQueue.ts` (`autoDeclineUnofferable`,
  `pendingRequests`, `mapCalendarItemsToCoverageGames`),
  `web/src/components/FamilyScreen.tsx` (`onCreateAgendaRide`,
  `onAssignCoverage`, `recentlyWithdrawnRideIds` pattern),
  `web/src/components/AgendaRow.tsx` (inbound band — wire `autoDeclined`),
  `web/src/components/AgendaInboundRequestRow.tsx` (chip + Reconsider already
  present)

## Acceptance criteria

- [ ] After **Ask the team** succeeds, every previously pending inbound ask on
      that event shows chip **Declined — you needed a ride too**; Accept/Pass
      are hidden; the ask is excluded from `getQueue` / hero actionable pending
      (via `autoDeclined`).
- [ ] Auto-decline of inbound asks fires **only** when view-model
      `ownRide === "requested"` — not for `"unassigned"` or
      `{ driver, confirmed: false }`.
- [ ] Auto-declined ride ids survive leaving `"requested"` (e.g. cancel ask or
      later assign) until Accept/Reconsider clears them; with a confirmed
      household driver (`canOffer`), **Reconsider** appears and calling it
      accepts via existing `acceptRide`.
- [ ] **Assign** household coverage while a PENDING `ownRequest` covers any of
      the assigned kids cancels that team ask (existing `cancelRide`) with **no
      confirmation dialog**; after reload, own ride is no longer `"requested"`.
- [ ] Reload while own ride is still `"requested"` re-applies auto-decline to
      current pending inbound asks (invariant does not depend on a single
      click-handler remembering to run).
- [ ] No new OpenAPI fields; no warning copy before **Ask the team**.
- [ ] Tests cover: ask-team → inbound chip + queue exclusion; assign-with-open-ask
      → `cancelRide` called; unassigned / pending-confirm do not auto-decline;
      Reconsider path still works when `autoDeclined` + `canOffer`.

## Tasks

- [ ] Web: session `autoDeclinedRideIds` (or equivalent) in `FamilyScreen`;
      merge into coverage view-model / inbound row props after remap +
      `autoDeclineUnofferable`
- [ ] Web: wire `autoDeclined` through `AgendaRow` → `AgendaInboundRequestRow`;
      clear id on Accept/Reconsider success
- [ ] Web: in `onAssignCoverage` success path, cancel PENDING `ownRequest`
      when kid sets intersect; reload rides (and calendar as today)
- [ ] Web: ensure Ask-the-team / remap paths cannot leave pending inbound
      actionable while `ownRide === "requested"` (central post-update step,
      not only the createRide handler)
- [ ] Tests: `FamilyScreen` / `AgendaRow` (or focused unit tests) for ask-team
      auto-decline UI + assign→cancel-own-ask; extend `coverageQueue` only if
      merge helpers are new
- [ ] Docs: point ADR-0002 / roadmap Coverage links at this active spec while
      in flight (this PR)

## Open questions

- **None blocking.** Assign→cancel-own-ask confirmed in `/spec` (2026-08-31).
  Sticky client `autoDeclined` (not server field) matches
  `ride-revert-undo`’s Reconsider contract and the cancelled
  `assign-cancels-carpool-request` supersession.
