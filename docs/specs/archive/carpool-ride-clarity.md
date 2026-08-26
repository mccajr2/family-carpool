# Spec: carpool-ride-clarity

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-25  
Updated: 2026-08-26 (`/pr`)  
Added: 2026-08-25 · enhancement  
Branch: `carpool-ride-clarity`

## Problem

Dogfood: after a teammate accepts, Calendar still reads like a **family
coverage gap**. Collapsed Agenda shows **Needs coverage** next to **Accepted ·
{circle}** (dogfood: “Accepted: Sharks Family”). Focus pills only run the
coverage ladder — they never show the ride chip — so the hero can look
uncovered even when a teammate is driving.

Those kids are uncovered in the coverage API (coverage stays orthogonal), but
the transport plan is done. The row should read **Riding with {circle name}**,
not a gap. v1 is both legs; “Picked up by…” undersells the return.

Separately, Focus still shows **Assign coverage** without **Request** when
Request is the next action on a joined, requestable FEED event. Incoming
teammate asks that correctly land on Focus have Accept/Pass but no **who is
asking** and no **pickup address** (already on the ride; v1 pickup is the
requester’s house).

## Non-goals

- Un-pass / Accept after Pass —
  [`carpool-pass-reconsider`](../planned/carpool-pass-reconsider.md)
- Changing v1 ride shape (both legs, pickup at requester house)
- Multi-stop / meet-at / to-XOR-from
- Carpool tab visual restyle or copy rewrite
  ([`carpool-page-redesign`](../planned/carpool-page-redesign.md)) — tab may
  keep “Accepted by {circle}”
- Adding `requestedByDisplayName` (or any field) to `CarpoolRide` — circle
  name, kid first names, and pickup snapshot are already on the payload
- Mutating coverage / `uncoveredKidIds` on the server
- Distinct chip color / new tokens — mint `Riding with` is enough
- Expo / KMP / push / in-app inbox
- Focus chrome restyle ([`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md))

## Approach

**Web Calendar only.** No OpenAPI bump. Join via `eventKey` already shipped
([`calendar-item-event-key`](../archive/calendar-item-event-key.md)).

**Transport gap vs coverage API (locked):** `uncoveredKidIds` is unchanged.
Agenda/Focus chrome treats kids on **this circle’s `ACCEPTED` `ownRequest`** as
not a coverage gap:

| Surface | Rule |
|---------|------|
| Remaining gap kids | `item.uncoveredKidIds` minus `ownRequest.kidIds` when `ownRequest.status === ACCEPTED`; otherwise all `uncoveredKidIds` |
| **Needs coverage** chip / row copy | Only remaining gap kids (names when the row lists them) |
| **Assign coverage** | Only when remaining gap kids is non-empty |
| Focus family-decision / urgent surface | Remaining gap kids, not raw `uncoveredKidIds`. Own `PENDING` ride does **not** clear the gap (still waiting) |
| Mixed | Ride covers some kids, others still uncovered → **Riding with {circle}** and **Needs coverage** both show |

**Copy (Agenda collapsed chips + Focus pills + expanded own-ride status
line):**

| Ride | Chip / line |
|------|-------------|
| `ACCEPTED` | **Riding with {acceptingCircleName}** (mint). Blank name → **Riding with a teammate** |
| `PENDING` | **Requested** (amber) — unchanged |

Do not use “Accepted ·”, “Accepted:”, or “Picked up by”.

Focus pills today call only `agendaItemStatusTags` (no ride chip). Compose
coverage tags + `agendaOwnRideStatusChip` on both collapsed rows and Focus.
Chip order: existing coverage ladder, with **Needs coverage** using remaining
gap kids; insert the ride chip immediately after **Overlaps** (or first if no
overlap).

**Focus Request CTA:** `AgendaFocusCard` already shows Request when
`rideEvent` is joined (`ownRequest` null, `defaultKidIds` non-empty). Dogfood
missed it because FamilyScreen never asserted that path (join test parks Focus
on a decoy; calendar fixture `eventKey` is often null). This slice: when Focus
**is** that requestable FEED item (eventKey match, uncovered remaining-gap
kids, no own request), **Request** is primary and **Assign coverage** is
secondary. Precedence otherwise unchanged (Confirm → Accept/Pass → Request →
Assign). If the FamilyScreen test fails, fix join/wiring — do not invent a
second Request path.

**Incoming ask on Focus:** when Accept/Pass is shown, render one summary line
from the eligible `otherRequest`, matching Carpool tab `OtherRideRequest`:
`{requesting circle} · {kid first names} · {pickupPlaceName}, {pickupAddress}`.
Who = `requestingCircleName` via `circleDisplayName` (not the requesting
adult). Pickup = existing snapshot.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Rides + Clients — amend Clients: ACCEPTED own ride is not a Calendar gap;
  Focus incoming who/where) · **Coverage (detail)** (API stays orthogonal;
  chrome interprets ACCEPTED ride) · **Interaction UX** → **Forward-looking
  seams** (Focus CTA precedence unchanged)
- Coverage chrome: `docs/agenda-coverage-web-contract.md` → **Coverage** →
  **Display** (status-tag ladder; Needs coverage vs ride)
- Focus pills: `docs/agenda-focus-card-addendum.md` → status pills (ride chip
  on Focus)
- Reuse (do not re-litigate): [`agenda-focus-carpool-actions`](../archive/agenda-focus-carpool-actions.md)
  (Request primary + Assign secondary; ranking) ·
  [`carpool-request-accept`](../archive/carpool-request-accept.md) (pickup
  snapshot; members already see address)
- Source: `web/src/components/coverageDisplay.ts` (`agendaItemStatusTags`,
  `focusItemNeedsFamilyDecision` callers) ·
  `web/src/components/carpoolDisplay.ts` (`agendaOwnRideStatusChip`,
  `ownRideStatusLine`) · `web/src/components/agendaFocusSelection.ts` ·
  `web/src/components/AgendaFocusCard.tsx` ·
  `web/src/components/AgendaRow.tsx` ·
  `web/src/components/calendarRideJoin.ts` ·
  `web/src/components/FamilyScreen.tsx` (Focus `rideEvent` / `onCreateRide`) ·
  `web/src/components/CarpoolSpaceRides.tsx` (`OtherRideRequest` line — copy
  pattern only)

## Acceptance criteria

- [x] After this circle’s ride is `ACCEPTED`, collapsed Agenda and Focus pills
      show **Riding with {accepting circle name}** (mint). They do **not**
      show **Needs coverage** for kids on that ride, and do **not** show
      **Accepted ·** / **Accepted:** copy.
- [x] When every `uncoveredKidIds` kid is on that `ACCEPTED` ride, Focus is
      not a family coverage decision: no **Assign coverage**, no urgent
      needs-decision surface **from coverage alone** (conflict / pending
      Confirm / eligible Accept still apply as today).
- [x] When some kids remain uncovered and not on the `ACCEPTED` ride, **Needs
      coverage** and **Assign coverage** still apply to those kids, and
      **Riding with {circle}** still shows.
- [x] Own `PENDING` request still shows **Requested**; **Needs coverage** /
      **Assign** still apply (gap not cleared until accept).
- [x] Focus on a carpool-eligible FEED item that joins a listed ride event by
      `eventKey`, with `ownRequest == null` and non-empty `defaultKidIds`,
      shows **Request** as primary. If the item also has remaining gap kids,
      **Assign coverage** is secondary on the same card — not the only CTA.
      FamilyScreen (or equivalent joined-shell) test; would fail if Request
      were missing.
- [x] Focus Accept/Pass for an incoming `PENDING` ask shows requesting circle
      name, kid first names, and pickup place name + address from that ride.
      No new OpenAPI fields.
- [x] Carpool tab ride list copy is unchanged. No contract version bump.

## Tasks

- [x] Web: helper for remaining gap kids (`uncoveredKidIds` minus ACCEPTED
      `ownRequest.kidIds`); use it in coverage chips, Assign visibility, and
      `focusItemNeedsFamilyDecision` (not raw `uncoveredKidIds`)
- [x] Web: `agendaOwnRideStatusChip` / `ownRideStatusLine` → **Riding with
      {circle}**; Focus pills include the ride chip; coverage ladder uses
      remaining gap kids
- [x] Web: Focus incoming-ask summary line (circle · kids · pickup) above
      Accept/Pass
- [x] Web: FamilyScreen test — Focus on joined requestable uncovered FEED
      (`eventKey` match) shows Request primary + Assign secondary
- [x] Docs: `docs/agenda-coverage-web-contract.md` Display ladder;
      `docs/agenda-focus-card-addendum.md` pills; `docs/architecture.md`
      Team carpool **Clients** (+ Coverage chrome note)
- [x] Tests: `carpoolDisplay` / `coverageDisplay` / `agendaFocusSelection` /
      `AgendaFocusCard` / `AgendaRow` unit tests for the AC above (including
      mixed remaining-gap + Riding with)

## Open questions

None — locked in Approach. Distinct chip color and requester adult display
name stay out of this slice unless dogfood says circle name is not “who.”
