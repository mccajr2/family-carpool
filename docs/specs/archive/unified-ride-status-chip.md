# Spec: unified-ride-status-chip

Status: done  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `unified-ride-status-chip`  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md)

## Problem

Agenda collapsed rows and the Focus card still compose **multiple** status chips
from two vocabularies — coverage tags (`Needs coverage`, `Confirm coverage`,
`Confirmed`, `All set`) plus a separate own-ride chip (`Requested`, `Riding
with …`) via `agendaItemStatusTags` + `agendaOwnRideStatusChip` +
`insertOwnRideStatusChip`. That stack is hard to scan and never distinguishes
**you're driving just your own kid** from **you're driving your kid and
carpooling teammates** (`acceptedRiders`).

The hero & coverage redesign already models ride-side truth in
`coverageQueue.ts` (`OwnRideStatus`, `acceptedRiders`, `pendingRequests`). Chips
should read from that view-model — one glanceable ride-status chip per event,
plus a separate inbound-ask chip — so [`hero-attention-carousel`](../planned/hero-attention-carousel.md)
and [`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md) reuse the
same labels and tones.

## Non-goals

- Merging inbound carpool ask **count** into the ride-status chip (separate
  `CarpoolAskChip`)
- Replacing `CarpoolFeedStatusChip` on the Feeds tab or other non-Agenda surfaces
- Hero carousel wiring ([`hero-attention-carousel`](../planned/hero-attention-carousel.md))
- Collapsed-by-default list rows / highlight sync
  ([`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md)) — consume
  helpers only
- One-click ride reverts and expanded **drive** copy pass
  ([`ride-revert-undo`](../planned/ride-revert-undo.md))
- Week-at-a-glance rollup strings ([`agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
  week-glance table) — may still say "needs coverage" until a later polish rank
- OpenAPI / backend changes
- iOS / Expo
- Full copy/a11y polish ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))

## Approach

Add a **pure** chip helper module (e.g. `rideStatusChip.ts` colocated with
`coverageQueue.ts`, or exports from `coverageQueue.ts` if small) that maps
`CoverageGameEvent[]` + `currentAdultId` → chip descriptors consumed by
`AgendaStatusChip`.

**Inputs per `CalendarItem`**

1. `mapCalendarItemToCoverageGames(item, rideEvent, options)` → one
   `CoverageGameEvent` per kid on the item (existing mapper).
2. Shared inbound asks on the joined `CarpoolRideEvent` (`otherRequests`).

**Ride-status chip (one per event)**

- **`not_going` wins:** when **every** kid on the item is out-of-play (`attendance
  === "not_going"`), emit a single muted **Not going** chip; no other chips.
- Otherwise aggregate **in-play** kid rows on that item only. Pick the **most
  urgent** row using the same urgency ordering as `getQueue` would among those
  rows (own-ride gap before calm states; soonest `order` within a tier). The
  chip reflects that row's `ownRide` + `attendance` — not a merge of conflicting
  labels.
- Map `OwnRideStatus` (+ viewer context) to **Title Case** label + tone.

  **Teammate ride wins over household driver label:** when this circle's
  `ownRequest.status === "ACCEPTED"`, emit **Riding with {acceptingCircleName}**
  (mint; blank name → **Riding with a teammate**) — even though the mapper stores
  the accepting circle in `ownRide.driver`. Do not label that state **{name}
  driving**.

  Otherwise map `ownRide` for in-play kids:

| Condition | Label | Tone |
| --------- | ----- | ---- |
| `unassigned` | Ride needed | amber |
| `requested` | Asked the team | amber |
| `{ driver, confirmed: false }` and assignee is signed-in adult | Confirm you'll drive | amber |
| `{ driver, confirmed: false }` and assignee is someone else | Waiting on {driver} | amber |
| `{ driver: "You", confirmed: true }` and `acceptedRiders` empty | You're driving | mint |
| `{ driver: "You", confirmed: true }` and `acceptedRiders` non-empty | You're driving · +{n} (`n` = `acceptedRiders.length` on that game row) | route |
| `{ driver: other name, confirmed: true }` and `acceptedRiders` empty | {name} driving | mint |
| `{ driver: other name, confirmed: true }` and `acceptedRiders` non-empty | {name} driving · +{n} | route |

  **`+{n}` suffix:** same `acceptedRiders.length` on the picked game row — for
  **You** and for **other household drivers** so adults can see at a glance that
  someone is driving teammates too, not only when the signed-in adult is driver.

- **Calm resolved** household driver with no inbound ask urgency and no overlap:
  still show the mint **You're driving** / **{name} driving** / **Riding with …**
  chip when `isConfirmedDriver` or teammate-ride applies — or **route** when
  `+{n}` applies — do **not** resurrect **Confirmed** / **All set** tags on
  Agenda surfaces.
- **Overlaps** stays a **separate** amber chip when `item.conflicts.length > 0`
  (calendar conflict, not ride status). Render **Overlaps** before the
  ride-status chip when both apply.

**CarpoolAskChip (optional second chip)**

- When there is at least one **actionable** inbound pending request on the
  joined ride event (`pendingRequests` semantics: `status === "pending"`, not
  `autoDeclined`, not `passedByMe`), emit amber **1 carpool ask** / **{n}
  carpool asks**.
- Shared across kid rows on the same event (one count per item, not per kid).

**Presentation**

- Reuse `AgendaStatusChip` tag mode (`feedChip*`, CSS uppercase, no leading dot).
- `route` tone uses existing `agendaStatusChip` **route** / accent fill (teal
  in mocks — already wired to `--fc-accent` / hero accent).
- Focus card passes `variant="hero"`; collapsed `AgendaRow` uses default variant.

**Retire on Agenda surfaces**

- `agendaItemStatusTags`, `insertOwnRideStatusChip`, and `agendaOwnRideStatusChip`
  for Focus + collapsed `AgendaRow` chip rows. Keep underlying gap helpers
  (`remainingCoverageGapKidIds`, `pendingCoverageForAdult`, etc.) for CTAs,
  expanded bands, and week glance — only the **collapsed chip vocabulary** moves.
- `agendaOwnRideStatusChip` may remain for Carpool tab / other surfaces until a
  later slice explicitly migrates them.

No contract changes.

## Context

- Design: `docs/ui-system.md` → Badge / chip (`feedChip*`, tone fills)
- Addendum: `docs/agenda-full-redesign-addendum.md` → collapsed row chips,
  out-of-play **Not going** rule
- Contract (chip precedence baseline being replaced): `docs/agenda-coverage-web-contract.md` → Coverage → Collapsed status tags
- View-model: `web/src/components/coverageQueue.ts` (`OwnRideStatus`,
  `acceptedRiders`, `pendingRequests`, `mapCalendarItemToCoverageGames`)
- Current chip stack to replace: `web/src/components/coverageDisplay.ts`
  (`agendaItemStatusTags`, `insertOwnRideStatusChip`),
  `web/src/components/carpoolDisplay.ts` (`agendaOwnRideStatusChip`)
- Consumers: `web/src/components/AgendaFocusCard.tsx`, `web/src/components/AgendaRow.tsx`
- Chip primitive: `web/src/components/agendaStatusChip.tsx`
- Tests: colocated `rideStatusChip.test.ts` (or `coverageQueue.test.ts` extension),
  update `AgendaFocusCard.test.tsx`, `AgendaRow.test.tsx`, `coverageDisplay.test.ts`
  only where chip composition is asserted

## Acceptance criteria

- [x] Pure helpers return ride-status + carpool-ask chip descriptors from
  `CoverageGameEvent[]` + `currentAdultId` with the label/tone table above;
  `not_going` on all kids yields only **Not going** (muted).
- [x] **You're driving · +{n}** uses `route` tone when the signed-in adult is
  confirmed driver (`driver === "You"`) and `acceptedRiders.length > 0`; **You're
  driving** without suffix uses `mint` when `acceptedRiders` is empty.
- [x] **{name} driving · +{n}** uses `route` tone when another household adult is
  confirmed driver and `acceptedRiders.length > 0`; **{name} driving** without
  suffix uses `mint` when `acceptedRiders` is empty.
- [x] Pending household assignee sees **Confirm you'll drive** (amber), not
  **Confirm coverage**; assigner sees **Waiting on {name}** (amber).
- [x] **Ride needed** replaces **Needs coverage** on collapsed Focus + AgendaRow
  chips (expanded row copy may still name uncovered kids — unchanged).
- [x] **Asked the team** replaces **Requested** for team-ask state (`ownRide ===
  "requested"`).
- [x] **Riding with {name}** applies when `ownRequest.status === "ACCEPTED"` (mint),
  not **{name} driving**.
- [x] **Overlaps** remains a separate chip when conflicts exist; ordering is
  Overlaps → ride-status → carpool-ask(s).
- [x] **CarpoolAskChip** shows actionable inbound pending count; ride-status chip
  does **not** include that count.
- [x] Multi-kid events: chip reflects the most urgent in-play kid row on that
  item (test: one uncovered kid + one confirmed driver kid → **Ride needed**).
- [x] Out-of-play items: single **Not going** chip, no carpool-ask or overlaps
  chips.
- [x] `hero-attention-carousel` / `weekly-list-focus-sync` can import chip
  helpers without re-deriving labels (exported functions + tests are the
  contract).
- [x] No OpenAPI or backend changes.

## Tasks

- [x] Web: add `rideStatusChip.ts` (or extend `coverageQueue.ts`) with
  `rideStatusChipsForItem(...)` and `carpoolAskChipForRideEvent(...)` (+ any
  small `pickMostUrgentGameRow` helper scoped to one calendar item)
- [x] Web: wire `AgendaFocusCard` + collapsed `AgendaRow` to new helpers;
  remove `focusStatusChips` / `agendaItemStatusTags` composition for those surfaces
- [x] Web: ensure `route` tone is used on Focus hero chips when applicable
- [x] Tests: unit tests for label/tone mapping, multi-kid urgency, not_going,
  +N suffix (You and other household driver), carpool-ask count, overlaps ordering
- [x] Tests: update Focus + AgendaRow tests that assert old chip strings
