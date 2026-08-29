# Spec: household-driver-assignment

Status: draft  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `household-driver-assignment`  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md)  
Governs: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)

## Problem

A binary "I'll drive" / "ask the team" choice doesn't reflect real households —
often someone else in the family (a spouse, a grandparent) can drive instead,
and offering only "you" or "strangers" skips the obvious middle option.

The shipped Focus card still uses a generic adult `<select>` plus separate
**Request** and **Assign coverage** buttons. That hides the household-vs-team
distinction, makes self-assign feel like admin work, and doesn't match the
view-model in `coverageQueue.ts` (`OwnRideStatus`: unassigned, pending household
confirm, confirmed driver, or team-requested).

## Non-goals

- **Hero carousel** wiring ([`hero-attention-carousel`](../planned/hero-attention-carousel.md)) — export `DriverPicker` for reuse; integrate only on today's Focus card
- **Agenda row** expanded assign UX ([`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md))
- **Unified status chip** copy/tones ([`unified-ride-status-chip`](../planned/unified-ride-status-chip.md)) — pending household confirm may still use existing "Covering … · Pending" until rank 2
- **Full inbox** for the asked household member — assignee **Confirm/Decline** on Focus (existing) is enough; no new notification surface
- **`autoDeclineUnofferable` wiring** ([`auto-decline-unofferable`](../planned/auto-decline-unofferable.md)) — team ask creates `"requested"` state; auto-decline stays a later rank
- **Ride revert / undo** links ([`ride-revert-undo`](../planned/ride-revert-undo.md))
- **Attendance toggle UI** ([`attendance-manual-toggle`](../planned/attendance-manual-toggle.md)) — only the ADR-0003 side effect on assign (RSVP → YES) lands here
- **OpenAPI / backend** changes — existing coverage assign/confirm/decline + carpool create + RSVP endpoints are sufficient
- **Copy/a11y polish pass** ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))

## Approach

Add a reusable **`DriverPicker`** component under `web/src/components/` and
replace the Focus card's assign dropdown + standalone **Request** button with it
when the event still has a coverage gap.

**Household section (primary path)**

- Horizontal **member chips** for every circle adult; current user labeled **You**
  (reuse `memberLabel` / `householdDriverLabel` conventions from
  `coverageQueue.ts`).
- Default selection: **You**.
- Primary confirm button, label depends on selection:
  - **Confirm I'll drive** when You is selected → `assignCalendarCoverage`
    (self-assign → backend `CONFIRMED` → `{ driver: "You", confirmed: true }`).
  - **Ask {name} to drive** when another adult is selected → same assign API
    (other-assign → backend `PENDING` → `{ driver: name, confirmed: false }`).
- When multiple uncovered kids, preserve today's kid-subset behavior (checkboxes
  or equivalent) so confirm assigns only selected kids.

**Team section (secondary path, visually separated)**

- Caption: **Nobody in the household free?**
- Button: **Ask the team for a ride** → existing `createRide` for the event
  (maps to `ownRide === "requested"`). Replaces the separate Focus **Request**
  button whenever `DriverPicker` is shown.

**Pending household confirm (state, not new inbox)**

- Assigning another adult creates `PENDING` coverage (already implemented server-side).
- Assignee continues to see **Confirm coverage** / **Decline coverage** on Focus
  when `pendingForSelf` (no change to that flow).
- Assigner sees existing active-coverage row until rank 2 adds **Waiting on {name}**
  chip vocabulary.

**ADR-0003 side effect**

- After any successful household assign (self or other) that names a real driver,
  reset each assigned kid's RSVP to **YES** via `setCalendarRsvp` when currently
  `NO` (client-side until [`attendance-manual-toggle`](../planned/attendance-manual-toggle.md)).
- Team ask (`createRide`) does **not** reset RSVP.

No contract changes. Component props accept `members`, `currentAdultId`, gap
`kidIds`, loading/error callbacks — same handlers `FamilyScreen` already passes
to `AgendaFocusCard`.

## Context

- Decisions: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)
- Prior slice: [`coverage-priority-engine`](../archive/coverage-priority-engine.md) → `web/src/components/coverageQueue.ts` (`OwnRideStatus`, `isPendingHouseholdConfirm`, mapper)
- Coverage helpers: `web/src/components/coverageDisplay.ts` → `remainingCoverageGapKidIds`, `activeCoverages`, `memberLabel`
- Focus integration: `web/src/components/AgendaFocusCard.tsx`, `web/src/components/FamilyScreen.tsx` → `onAssignCoverage`, `onCreateRide`, `coverageAssignState`
- APIs: `web/src/api/familyClient.ts` → `assignCalendarCoverage`, `setCalendarRsvp`; `web/src/api/carpoolClient.ts` → `createRide`
- Visual: existing Focus action tokens (`--fc-font-focus-action-*`, chip spacing from Feeds-style patterns); full separation polish deferred to [`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md)

## Acceptance criteria

- [ ] `DriverPicker` renders household member chips (You + other adults), default **You** selected.
- [ ] Confirm label is **Confirm I'll drive** for You, **Ask {name} to drive** for any other selected adult.
- [ ] Confirm calls `onAssignCoverage(adultId, kidIds)` with the selected adult and current kid subset.
- [ ] **Nobody in the household free?** caption and **Ask the team for a ride** button are visually separated from household chips (divider or spacing — not inline with chips).
- [ ] Team button calls `onAskTeam` / `onCreateRide` for the event; standalone Focus **Request** button is hidden when `DriverPicker` is shown.
- [ ] Self-assign produces `CONFIRMED` coverage; other-assign produces `PENDING` — verified by component or integration test against mocked API responses.
- [ ] Assignee `pendingForSelf` flow still shows Confirm/Decline (regression test).
- [ ] After household assign, any assigned kid with RSVP `NO` is updated to `YES` before calendar item refresh (ADR-0003).
- [ ] `mapCalendarItemToCoverageGames` reflects post-action state: self → `{ driver: "You", confirmed: true }`, other pending → `{ driver, confirmed: false }`, team ask → `"requested"`.
- [ ] `DriverPicker` exported and mountable without Focus (props-only) for [`hero-attention-carousel`](../planned/hero-attention-carousel.md).

## Tasks

- [ ] Web: add `DriverPicker.tsx` (+ colocated `DriverPicker.test.tsx`) with chips, confirm, separated team section
- [ ] Web: integrate `DriverPicker` into `AgendaFocusCard` — replace assign `<select>` + **Assign coverage** + standalone **Request** when `showAssign`
- [ ] Web: in `FamilyScreen` (or assign handler), chain `setCalendarRsvp(..., YES)` for assigned kids currently `NO` after successful household assign
- [ ] Web: preserve multi-kid subset UI when `!assignDraft.soleKid`
- [ ] Tests: `DriverPicker.test.tsx` — chip selection, confirm labels, team button separation, disabled while loading
- [ ] Tests: update `AgendaFocusCard.test.tsx` / `FamilyScreen.test.tsx` — household self vs other assign, team ask replaces Request, RSVP reset on assign, assignee confirm unchanged

## Open questions

- **Kid subset placement:** **Default** — keep checkboxes immediately above `DriverPicker` (same as today's expanded row pattern) rather than embedding inside the component; revisit in [`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md) if carousel layout needs inline kids.
- **Visual tokens:** **Default** — reuse existing Focus/chip CSS variables; no new `design-tokens/tokens.json` roles until a destination mock is checked in (polish rank 9).
