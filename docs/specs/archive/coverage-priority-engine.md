# Spec: coverage-priority-engine

Status: done  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial (hero & coverage flow redesign import)  
Branch: `coverage-priority-engine`  
Governs: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md), [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md), [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)

## Problem

Every downstream slice in the hero & coverage flow redesign asks the same
question — "what's next, and what state is each game in?" — and must get the
same answer from the same place. Duplicating sort/filter logic per component is
how the original bug happened (a hero card that surfaced a teammate's carpool ask
ahead of an own-child coverage gap).

This slice establishes the shared view-model types, derived helpers, priority
queue (`getQueue`), and the `autoDeclineUnofferable` transform. **No UI.**

## Non-goals

- Any rendering ([`household-driver-assignment`](../active/household-driver-assignment.md), [`hero-attention-carousel`](../planned/hero-attention-carousel.md), [`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md))
- Wiring `autoDeclineUnofferable` into live mutation handlers ([`auto-decline-unofferable`](../archive/auto-decline-unofferable.md))
- Replacing `selectFocusItem` or `AgendaFocusCard` in this PR (those migrate in later ranks)
- OpenAPI / backend persistence for the new attendance model (client view-model + mapping shim is enough here; full RSVP migration is [`attendance-manual-toggle`](../planned/attendance-manual-toggle.md))
- Re-adding a three-option cancellation panel or three-way RSVP control (deliberately cut — see ADRs)

## Approach

Add a **pure TypeScript module** under `web/src/components/` (e.g.
`coverageQueue.ts`) with:

1. **View-model types** (`CoverageGameEvent`, `OwnRideStatus`, `CarpoolRequest`,
   `Attendance`, `QueueItem`) expressing the validated mockup semantics — not
   necessarily identical to OpenAPI shapes.
2. **Mapper(s)** from existing `CalendarItem` + joined `CarpoolRideEvent` →
   `CoverageGameEvent[]` (one row per in-play kid/event combination as needed).
   Map RSVP: `YES` / `NO_RESPONSE` → `"going"`, `NO` → `"not_going"`.
3. **Derived helpers:** `isUnassigned`, `isPendingHouseholdConfirm`,
   `isConfirmedDriver`, `acceptedRiders`, `pendingRequests`.
4. **`getQueue(games)`** — own-ride gaps first (soonest `order`), then pending
   inbound requests (soonest `order` within each game). Empty array = all caught
   up (no sentinel type).
5. **`autoDeclineUnofferable(games)`** — when `ownRide === "requested"`, decline
   all pending requests on that game with `autoDeclined: true`. Trigger **only**
   on `"requested"`, not `"unassigned"` or pending household confirm.

Household member names for `OwnRideStatus.driver` come from circle adults (current
user as `"You"` + other member display names). No household management UI in
this slice — assume readable from existing family context.

**Downstream contract:** assigning any real driver must also reset attendance to
`"going"` ([ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)) —
implemented in [`household-driver-assignment`](../active/household-driver-assignment.md).

## Context

- Decisions: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md), [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md), [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)
- Current focus selection (to be replaced later): `web/src/components/agendaFocusSelection.ts` → `selectFocusItem`
- Coverage gap helpers: `web/src/components/coverageDisplay.ts`
- Carpool join + ride status: `web/src/components/carpoolDisplay.ts`, `web/src/components/calendarRideJoin.ts`
- API types: `web/src/api/types.ts` (`CalendarItem`, `CarpoolRide`, `RsvpStatus`)
- Tests colocated: `web/src/components/coverageQueue.test.ts`

## Acceptance criteria

- [x] View-model types and mapper exist; deviations from the package sketch are documented in this spec or PR description.
- [x] `getQueue`, all five derived helpers, and `autoDeclineUnofferable` live in one shared module importable by downstream ranks.
- [x] Unit tests cover: an own-ride gap beats a sooner pending request; a `not_going` game never produces a queue item even if `ownRide` is unassigned; multiple gaps/requests ordered soonest-first by `order`; all-resolved input returns `[]`.
- [x] `autoDeclineUnofferable` only fires on `ownRide === "requested"` — tests assert pending requests survive untouched for `"unassigned"` and `{ driver, confirmed: false }`.
- [x] No new UI re-implements queue sort/filter logic; existing `selectFocusItem` left untouched until [`hero-attention-carousel`](../planned/hero-attention-carousel.md).
- [x] Downstream contract documented: driver assignment resets attendance to `"going"`.

## Tasks

- [x] Web: add `coverageQueue.ts` with types, helpers, `getQueue`, `autoDeclineUnofferable`
- [x] Web: add mapper from `CalendarItem` + `CarpoolRideEvent` → `CoverageGameEvent` (minimal fields needed for queue logic)
- [x] Tests: `coverageQueue.test.ts` covering priority ordering, `not_going` exclusion, empty queue, auto-decline guard
- [x] Docs: note in PR if backend persistence for view-model fields is a separate workstream

## Open questions

- **Mapper granularity:** **Resolved** — one `CoverageGameEvent` per kid on the
  calendar row (`kidIds`); inbound `requests` are duplicated on each kid row for
  the same event so `getQueue` stays kid-accurate for own-ride gaps while sharing
  event-level carpool asks.
- **Household confirm state:** map from existing `CoverageStatus.PENDING` on assignments until [`household-driver-assignment`](../active/household-driver-assignment.md) introduces explicit household-driver ask UX.
