# Spec: ride-revert-undo

Status: draft  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `ride-revert-undo`  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md), [`unified-ride-status-chip`](../archive/unified-ride-status-chip.md), [`weekly-list-focus-sync`](../archive/weekly-list-focus-sync.md)  
Governs: [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)  
Blocks: [`auto-decline-unofferable`](../planned/auto-decline-unofferable.md) (Reconsider on auto-declined asks)

## Problem

Every resolved ride state is still a dead end in the Agenda UI — confirming
yourself as driver, asking the team, riding with a teammate, or accepting
teammates onto your ride cannot be undone without hunting admin controls
(**Remove coverage**, **Withdraw** buttons) that do not match the hero-flow
mock or ADR-0002's one-click, no-dialog cancellation model.

[`weekly-list-focus-sync`](../archive/weekly-list-focus-sync.md) deliberately
deferred **`RevertRideLink`** and inbound **Reconsider / Undo** copy. Parents
need the mock's underlined text actions: factual, immediate, and using **drive**
vocabulary (never **make it** — that belongs to attendance in rank 3).

## Non-goals

- Confirmation dialogs, apology copy, or optional reason notes before any revert
  ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md))
- **`autoDeclineUnofferable` mutation wiring** ([`auto-decline-unofferable`](../planned/auto-decline-unofferable.md) — rank 2); this slice ships Reconsider UI gated on `canOffer` so rank 2 can flip `autoDeclined` without UI rework
- **`AttendanceToggle`** going / not-going UI ([`attendance-manual-toggle`](../planned/attendance-manual-toggle.md))
- **`PickupLine`** detour minutes ([`carpool-pickup-detour`](../planned/carpool-pickup-detour.md))
- Revert links on hero carousel slides (queue items are gaps / pending asks only — resolved rides are not carousel slides)
- Carpool tab restyle beyond wiring existing handlers where needed for parity tests
- Full copy/a11y polish pass ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))
- iOS / Expo
- New pass/un-pass endpoints

## Approach

Add a reusable **`RevertRideLink`** component and extend **`AgendaInboundRequestRow`**
with mock **RequestRow** reverse actions. Wire handlers in **`FamilyScreen`**
and render from expanded **`AgendaRow`** per-kid bands (and anywhere else a
resolved own-ride row is shown without **`DriverPicker`**).

**Visual source:** [`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) → `RevertRideLink`, `RequestRow` (lines 267–291, 473–516).

### Visibility (match mock)

For each in-play kid row on an expanded Agenda item:

```text
showDriverPicker = not out-of-play AND (unassigned OR pending household confirm for viewer)
showRevertLink   = not out-of-play AND NOT showDriverPicker AND ownRide is resolved
```

`DriverPicker` and `RevertRideLink` are mutually exclusive on the same kid row.
Replace the legacy **Remove coverage** button on active coverage rows with
`RevertRideLink` at the kid-row level (mock places one link under the kid +
chip band, not a per-assignment admin button).

### Own-ride revert actions (`onCantMakeIt`)

One click, no dialog. Map `OwnRideStatus` → handler:

| `ownRide` state | Copy (drive vocab) | API |
| --------------- | ------------------ | --- |
| `{ driver, confirmed: true }` — You | Can't drive anymore? Reassign the ride | Remove coverage **+ auto-withdraw** accepted inbound rides (below) |
| `{ driver, confirmed: true }` — other household adult | {name} can't drive anymore? Reassign the ride | `removeCalendarCoverage` on that kid's active CONFIRMED assignment **+ same auto-withdraw** when caller's circle accepted inbound rides |
| `"requested"` (own PENDING team ask) | No longer need a ride? Cancel this ask | `cancelCarpoolRide` on `ownRequest` |
| `{ driver, confirmed: true }` from accepted `ownRequest` (teammate ride) | {teammate} can't drive anymore? Find a new ride | `cancelCarpoolRide` on accepted `ownRequest` |

After a successful revert, refresh calendar + carpool rides so chips and
`getQueue` update (same reload pattern as assign / cancel today).

**ADR-0002 atomic driver cancel:** removing CONFIRMED coverage where the
caller's circle is the accepting circle for inbound ACCEPTED carpool rides on
that event must **also withdraw those rides in the same server transaction**
(not a client-side loop). Extend `CalendarService.removeCoverage` (calendar
module calls carpool module API) and document the side effect on
`removeCalendarCoverage` in OpenAPI. Affected families see the ask return to
PENDING / their child uncovered — ADR-0001 queue handles their side.

### Inbound request reverse actions

On **`AgendaInboundRequestRow`** when not handed off to the hero carousel:

| State | Copy | Handler |
| ----- | ---- | ------- |
| ACCEPTED by us | Can't take them anymore | `withdrawCarpoolRide` (replace outline **Withdraw** button with underlined link) |
| Declined (incl. `autoDeclined` when present) | Reconsider | `acceptCarpoolRide` when `canOffer` (`isConfirmedDriver` on that kid row) |
| PENDING after viewer withdrew in this session | Undo | `acceptCarpoolRide` with Undo label — track `recentlyWithdrawnRideIds` client-side until reload (no backend flag today) |
| PENDING + `passedByMe` | Accept (existing) | unchanged — Focus still skips passed asks; expanded row may Accept per [`carpool-pass-reconsider`](../archive/carpool-pass-reconsider.md) |

`canOffer` = confirmed driver on that `CoverageGameEvent` row (`isConfirmedDriver` in `coverageQueue.ts`).

### Copy constants

Centralize strings in a small helper (e.g. `revertRideCopy.ts`) so tests lock
**drive** vs **going** separation. Never use **make it** on ride-side links.

### Tokens

Reuse existing secondary/subtitle text roles for underlined links (`text-xs`,
`underline-offset-2`, `text-secondary`). No new color roles unless contrast
check fails on `surfaceRaised`.

### Cross-domain coupling ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md))

Ride reverts are one-click with **no confirmation dialogs** on every path in
this slice. Cross-module behavior still matters — link these explicitly so
implementers do not rediscover them ad hoc.

| Interaction | Coupling | This PR |
| ----------- | -------- | ------- |
| **Remove CONFIRMED coverage** (any household driver on the assignment) | Same transaction: withdraw every inbound ACCEPTED carpool ride on that event where **caller's circle** was the acceptor ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md) §1). Not a client-side loop. | **Implement** + OpenAPI note on `removeCalendarCoverage` |
| **Withdraw inbound** (“Can't take them anymore”) | **No** change to caller's own coverage / confirmed driving ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md) §2). Single `withdrawCarpoolRide` call. | **Implement** UI only |
| **Withdraw inbound → requester side** | Affected family should land in an **unassigned / gap** queue state ([ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md) consequences + [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md)). Today a surviving PENDING `ownRequest` can map to **Asked the team** instead of a gap — resolve in implementation (view-model rule, withdraw side effect, or follow-up). | **Resolve or flag** in PR |
| Cancel team ask / cancel teammate ride | Single `cancelCarpoolRide`; no coverage cross-call | UI + existing API |
| Reconsider / Undo | Single `acceptCarpoolRide`; clears pass rows on success (existing) | UI + existing API |
| **Ask team / assign while inbound asks pending** | Auto-decline unofferable inbound asks on forward mutations | **Deferred** — [`auto-decline-unofferable`](../planned/auto-decline-unofferable.md) (rank 2); cross-link only |
| Assign coverage while open team ask still live | Historical assign/cancel coupling | **Deferred** — rank 2 may subsume; see cancelled [`assign-cancels-carpool-request`](../planned/assign-cancels-carpool-request.md) |

**Attendance / RSVP (transitional — not this PR's UI work)**

Explicit three-way RSVP controls on Agenda (**Yes / No / No response**) are
**retired** for this product surface ([ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md));
[`attendance-manual-toggle`](../planned/attendance-manual-toggle.md) (rank 3)
ships the **going / not going** toggle only. Until that rank (and any OpenAPI
migration it chooses), the API may still expose `YES` / `NO` / `NO_RESPONSE` with
client mapping (`YES`/`NO_RESPONSE` → going, `NO` → not_going).

Those backend couplings are **orthogonal to ride-revert** but share the same
“one mutation, documented side effects” pattern — do not confuse with
ride-side revert work:

| Mutation | Side effect (today's API) | Notes |
| -------- | ------------------------- | ----- |
| Assign / confirm coverage | Sets assigned kids to RSVP **YES** | Stays until rank 3; ADR-0003 “assign resets going” |
| Accept carpool ride | Sets requester kids to RSVP **YES** | [`carpool-request-accept`](../archive/carpool-request-accept.md) |
| Set **not going** (`NO` today) with active coverage | Hard-releases kid from assignment | Rank 3 toggle will call the same path; web confirm dialog today is **attendance**, not ride-revert — do not add ride-revert confirms |
| Cancel / withdraw / pass (ride) | Does **not** auto-change attendance | [architecture.md](../../architecture.md) Team carpool |

Ride-revert paths in this spec do **not** change attendance. Revert links stay
**drive** vocabulary; attendance stays **going** vocabulary ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md) later).

## Context

- **Visual mock:** `docs/ui-system/carpool-hero-flow-mockup-v6.jsx` → `RevertRideLink`, `RequestRow`, `onCantMakeIt`
- Design: `docs/ui-system.md`
- ADRs: [`ADR-0002`](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md) (ride cancel), [`ADR-0003`](../../decisions/ADR-0003-attendance-manual-default-going.md) (attendance ≠ RSVP UI)
- Forward coupling (rank 2): [`auto-decline-unofferable`](../planned/auto-decline-unofferable.md)
- Attendance UI (rank 3): [`attendance-manual-toggle`](../planned/attendance-manual-toggle.md)
- Queue / view-model: `web/src/components/coverageQueue.ts` → `isConfirmedDriver`, `mapCalendarItemToCoverageGames`, `OwnRideStatus`
- Chips: `web/src/components/rideStatusChip.ts`
- Row: `web/src/components/AgendaRow.tsx`
- Inbound band: `web/src/components/AgendaInboundRequestRow.tsx`
- Integration: `web/src/components/FamilyScreen.tsx`
- APIs: `web/src/api/familyClient.ts` (`removeCalendarCoverage`), `web/src/api/carpoolClient.ts` (`cancelRide`, `withdrawRide`, `acceptRide`)
- Backend: `backend/modules/calendar/.../CalendarService.java` → `removeCoverage`; `backend/modules/carpool/.../CarpoolRideService.java` → `withdraw`, `cancel`
- Contract: `contracts/openapi.yaml` → `removeCalendarCoverage` description
- Deferred row UX: [`docs/specs/archive/weekly-list-focus-sync.md`](../archive/weekly-list-focus-sync.md) → expanded body item 5

## Acceptance criteria

- [ ] Expanded Agenda kid row shows **`RevertRideLink`** (underlined text, no dialog) when own-ride is resolved and **`DriverPicker`** is hidden; link hidden for unassigned / pending household confirm / out-of-play.
- [ ] Confirmed-driver revert copy uses **drive** vocabulary per mock (You vs other household driver vs teammate ride vs cancel team ask).
- [ ] Clicking confirmed-driver revert removes coverage and returns the kid to an own-ride gap; **`DriverPicker`** appears on refresh without a confirmation step.
- [ ] Removing CONFIRMED coverage (self or other household driver on the assignment) auto-withdraws every ACCEPTED inbound carpool ride on that event where the caller's circle was the acceptor — verified in one backend integration test (single transaction; ride returns to PENDING).
- [ ] Withdrawing inbound acceptance does **not** remove caller's own coverage; documents or tests note requester-side gap behavior per cross-domain table (or open question closed in PR).
- [ ] Cancel team ask (`ownRequest` PENDING) and cancel teammate ride (`ownRequest` ACCEPTED) each use one click → `cancelCarpoolRide`; no dialog.
- [ ] Inbound ACCEPTED-by-us row shows **Can't take them anymore** link (not outline Withdraw); one click → withdraw; own ride status unchanged.
- [ ] **Reconsider** appears on declined inbound asks when `canOffer`; one click → accept with eligible vehicle rules unchanged.
- [ ] **Undo** appears after the viewer withdraws an acceptance in-session (before reload); one click re-accepts.
- [ ] No revert links on hero carousel slides (queue gaps only).
- [ ] OpenAPI documents auto-withdraw side effect on `removeCalendarCoverage`; web client unchanged signature.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass in `web/`; backend calendar + carpool tests pass for touched code.

## Tasks

- [x] Backend: extend `removeCoverage` to withdraw ACCEPTED inbound rides on the same event/space when caller's circle is acceptor; unit + integration tests
- [x] Contract: amend `removeCalendarCoverage` description (+ bump `info.version` if behavior text is contract-significant)
- [x] Web: `RevertRideLink` component + copy helper + colocated tests
- [ ] Web: `AgendaInboundRequestRow` — Can't take them anymore / Reconsider / Undo links; tests
- [ ] Web: `AgendaRow` expanded body — per-kid `RevertRideLink`, remove **Remove coverage** admin button; align band order with mock
- [ ] Web: `FamilyScreen` — `onCantMakeIt` orchestration (remove coverage, cancel own ride, reload); `recentlyWithdrawnRideIds` for Undo affordance
- [ ] Tests: revert confirmed driver → gap + DriverPicker; cancel team ask; withdraw inbound; auto-withdraw coupling; copy locks drive vocabulary

## Open questions

- **Multi-kid same event:** one `RevertRideLink` per kid row from `mapCalendarItemToCoverageGames` (not one link per calendar item) — confirm in PR if multi-kid expanded layout needs spacing tweak.
- **Undo without session memory:** if product later wants Undo after full page reload, add a `withdrawnByMe` (or similar) field in a follow-up contract slice — not required for this PR.
- **Withdraw → requester queue state:** PENDING `ownRequest` after acceptor withdraw may not match ADR-0002 “unassigned” on the requester's account — resolve in implementation (see cross-domain coupling table).
