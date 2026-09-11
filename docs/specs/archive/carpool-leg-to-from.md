# Spec: carpool-leg-to-from

Status: archived  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Updated: 2026-09-10 (`/pr` — archive after ship)  
Added: 2026-08-14 · enhancement  
Branch: `carpool-leg-to-from`

## Problem

v1 team rides are always **both legs** on one household request. Families often
need a ride **to** the event but not **from** it (or the reverse), and later
card UX must show **independent status per leg** while keeping round-trip
self-confirm as the default path. Without per-leg persistence and a four-state
status model, the coverage card cannot support split plans or truthful
Getting there / Coming back chips.

## Non-goals

- **Default collapsed coverage card chrome** (driver chips + leave-from
  combobox + live Confirm / Post to team labels) —
  [`carpool-ride-coverage-card`](../active/carpool-ride-coverage-card.md)
- **“Different plans for each leg” split editor** (independent driver +
  location per leg, Save ride plan) —
  [`carpool-leg-split-plans`](../planned/carpool-leg-split-plans.md)
- **Per-kid progressive split** (siblings on the same team with distinct
  drivers / legs / locations) —
  [`carpool-kid-split-plans`](../planned/carpool-kid-split-plans.md). This PR
  keeps one shared plan for all **going** kids on the event (same driver,
  round-trip, same location assumption).
- **Ask-the-team sub-flow** (home pickup vs radius drop-off / distance match)
  — [`carpool-meet-at`](../planned/carpool-meet-at.md). Ask the team stays a
  **plain** undifferentiated request.
- **Closed PR #107 remodel** (per-kid need rows as the only model, multi-circle
  passengers on one fulfillment) — do not revive that patch set
- **Per-leg leave-from / pickup / drop-off place selection** (card + meet-at)
- **CLAIMED / claimed-but-unconfirmed** intermediate state — claim = confirm
- Expo / push / KMP UI or `sharedLogic` OpenAPI updates (KMP frozen)
- Garage / seat-capacity gating (retired; parking `garage-capacity`)
- Carpool tab visual restyle — [`carpool-page-redesign`](../planned/carpool-page-redesign.md)

## Approach

Extend the existing Modulith **`carpool`** module. HTTP stays under
`/api/carpool/*`. **OpenAPI changes** (bump `info.version`): expose per-leg
plan state on ride list/detail (and create/accept/cancel/withdraw as needed);
update hand-written **web** clients in the same change (not KMP).

### Domain (locked)

Keep the **household-scoped kid bag** for this slice (one requesting circle +
event + non-empty `kidIds` of kids still **going**). Default product
assumption: every going sibling on that team event shares one plan — same
driver, both legs, same location. Add **two leg slots** always present for
that plan: `TO` (Getting there) and `FROM` (Coming back). Persist in a shape
that does **not** block later per-kid plans
([`carpool-kid-split-plans`](../planned/carpool-kid-split-plans.md)).

Each leg has exactly one of four phases (UI copy is source of truth; API enums
may be shorter — map 1:1):

| Phase | Meaning | Example chip |
|-------|---------|--------------|
| `NEEDS_RIDE` | No driver assigned | Needs ride |
| `WAITING_HOUSEHOLD` | Household adult selected, not confirmed | Waiting on Katy |
| `ASKED_TEAM` | Posted to the team, nobody confirmed | Asked team |
| `CONFIRMED` | Self, household adult, or teammate confirmed (Accept = confirm) | You're driving / {name} confirmed |

Do **not** add a fifth claimed-unconfirmed state.

Round-trip remains the **default write path**: existing Calendar
Confirm / Assign / Ask the team / Accept actions that today imply “the ride”
update **both** legs identically. Single-leg writes must exist in the API (for
`carpool-leg-split-plans`) even if this PR’s UI only exercises round-trip.

Team Accept on an ask that covers both still-open legs confirms **both**; an
ask that only needed one leg confirms that leg only. Pass stays per-adult soft
decline of a pending **team** ask (unchanged spirit).

**Combined cancel:** when both legs share the same assignee adult identity,
Cancel (own) / Withdraw (we accepted) / household cancel is **one** action that
clears both legs. Different assignees → per-leg. Location fields are out of
scope here; merge rule is **driver identity only**.

**Not going clears transport (locked):** Agenda copy is **“not going”** /
**Mark as not going** (ADR-0003 / `coverageCopy`) — not “cannot attend.” When
RSVP for a kid on a carpool-eligible feed event becomes **`NO`** (`not_going`):

1. Remove that kid from the circle’s ride plan `kidIds` for that space event.
2. Clear that kid from **all** legs — `ASKED_TEAM` / `WAITING_HOUSEHOLD` /
   `CONFIRMED` alike (pending asks and confirmed household or teammate
   fulfillments). Prefer **server enforcement** on the RSVP write (same spirit
   as coverage hard-release + ADR-0002 automatic cancel), not UI-only.
3. If no going kids remain on the plan, cancel/withdraw the whole plan (both
   legs → `NEEDS_RIDE` / no active ask).
4. If other going kids remain on a shared plan, keep the plan with the
   reduced `kidIds` / seats; do not leave the not-going kid listed on a live
   ask or confirmation.

Pickup snapshot at team-ask create stays requester-house (meet-at deferred).
Coverage responsibility rows may remain orthogonal for now; **transport status
chips** for this slice read the leg-slot phases (wire existing
DriverPicker / Accept paths so round-trip dogfood keeps working).

### Migration

Existing v1 both-legs rows must remain readable:

- `PENDING` team request → both legs `ASKED_TEAM`
- `ACCEPTED` → both legs `CONFIRMED` with accepting adult/circle
- Active household coverage `PENDING` / `CONFIRMED` with no overriding team
  fulfillment → both legs `WAITING_HOUSEHOLD` / `CONFIRMED` for that adult
  (same adult both ways)

### Web (minimal — this PR only)

- Shared helpers (`rideStatusChip`, `carpoolDisplay`, `coverageQueue` /
  related) expose **two** leg chips: Getting there / Coming back, using the
  four-state copy above (reuse `coverageCopy` vocabulary where it already
  matches; add only what’s missing).
- Surfaces that already show ride/coverage status (Focus / hero carousel,
  Agenda row, Carpool ride lines, week-glance as applicable) show the dual
  chips instead of a single both-legs blob.
- **Inbound / other-parent clarity (locked):** when the logged-in adult sees a
  hero or Focus ask to **Accept** (teammate team ask) or a **Waiting on {name}**
  household assign, the UI must make **which leg(s)** are in play obvious —
  one-leg TO-only or FROM-only must not read as an unspecified round-trip.
  Same for expanded Agenda inbound rows that already show Accept/Pass.
- Round-trip Request / Accept / Pass / Cancel / Withdraw / household Confirm
  keep working. **No** “Different plans for each leg” link, **no** per-kid
  split UI, **no** Confirm label redesign, **no** leave-from combobox restyle.
- Not-going path: after RSVP `NO`, refresh shows legs cleared for that kid
  (and dual chips / queue updated).

## Context

Allowlist for `/implement`:

- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Rides / Clients / Out of scope — update legs out of “out of scope” in the
  same PR); RSVP hard-release note under Family circle / Coverage as needed
- Decision: `docs/decisions/ADR-0002-automatic-non-blocking-cancellation.md`
  (automatic cancel spirit for not-going → clear legs)
- Decision: `docs/decisions/ADR-0003-attendance-manual-default-going.md`
  (going / not going vocabulary)
- Prior ship: `docs/specs/archive/carpool-request-accept.md` (household kid
  bag, Accept empty-body after garage-retire, Pass)
- Prior ship: `docs/specs/archive/garage-retire.md` (Accept open; no vehicleId)
- Prior ship: `docs/specs/archive/attendance-manual-toggle.md` (Agenda not-going)
- Contract: `contracts/openapi.yaml` → carpool rides paths + `CarpoolRide` /
  `CreateCarpoolRideRequest` / `CarpoolRideStatus`; RSVP PUT under calendar
- Backend: `backend/modules/carpool/.../CarpoolRideService.java`,
  `CarpoolRideRequestEntity.java`, ride controller + unit/integration tests;
  RSVP write path that must clear legs
- Web: `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`,
  `web/src/components/coverageCopy.ts`, `rideStatusChip.ts`,
  `carpoolDisplay.ts`, `coverageQueue.ts`, Focus / AgendaRow / Carpool ride
  surfaces that consume those helpers
- Goals source (product intent for later ranks; do not implement card chrome
  here): user Ride Coverage Card UI notes in the `/spec` thread — default vs
  split deferred to planned stubs below

Do not load `docs/roadmap.md` or whole-architecture dumps beyond the heading
above. Do not revive closed PR #107 patches.

## Acceptance criteria

- [x] OpenAPI documents per-leg phases for `TO` and `FROM` on the requesting
      circle’s ride plan (list + mutating responses as needed); `info.version`
      bumped; web clients updated in the same change.
- [x] Creating / confirming a **round-trip** plan (household self-confirm,
      household assign-pending, or Ask the team) for all **going** kids writes
      **both** legs to the matching phase; Accept on a both-legs team ask moves
      both to `CONFIRMED` with no intermediate claimed state.
- [x] API supports updating **one** leg without forcing the other (unit +
      integration coverage); this PR’s UI may only call the round-trip path.
- [x] Dual status chips render on Focus / hero + collapsed/expanded Agenda ride
      chrome (+ Carpool ride lines): e.g. `Getting there: Asked team` and
      `Coming back: Needs ride` when only TO was asked; both confirmed when
      round-trip accepted.
- [x] Hero / Focus inbound Accept (teammate ask) and Waiting-on-{household}
      states show which leg(s) are requested — a one-leg ask is visually
      distinct from round-trip (same clarity on expanded Agenda inbound rows
      that offer Accept/Pass).
- [x] Chip phases map only to the four states (Needs ride / Waiting on {name}
      / Asked team / You're driving | {name} confirmed) — no fifth state.
- [x] When both legs share the same assignee adult, a single Cancel or
      Withdraw clears **both**; when assignees differ, cancel is per-leg.
- [x] Marking a kid **not going** (RSVP `NO`) removes them from the plan and
      clears **all** their legs — pending team asks, waiting household, and
      confirmed — server-side; remaining going kids keep a reduced shared plan;
      last going kid cleared → whole plan cancelled. Integration test covers
      PENDING and ACCEPTED/CONFIRMED cases.
- [x] Flyway (or equivalent) migrates existing PENDING/ACCEPTED both-legs rows
      (and active household coverage pairing) so dogfood data stays coherent.
- [x] Backend unit + integration tests for create/accept/cancel/withdraw leg
      matrix + not-going clear; web helper tests for dual-chip derivation.
      `ModularityTests` still pass.
- [x] Architecture Team carpool **Rides** / **Out of scope** updated: legs
      in; not-going clears transport; per-kid split and meet-at still out.

## Tasks

- [x] Contract: OpenAPI per-leg schemas/fields + version bump; align summary
      copy that still says “both legs” only.
- [x] Backend: persist two leg slots; round-trip + single-leg writes; Accept /
      Pass / Cancel / Withdraw rules; combined cancel when same assignee;
      Flyway migration from v1 rows.
- [x] Backend: RSVP `NO` → remove kid from plan / clear all legs (and cancel
      empty plans); unit + integration coverage.
- [x] Backend: unit tests (`CarpoolRideServiceTest`) + integration tests
      (`CarpoolRideControllerIntegrationTest`) for leg matrix + migration
      readability + not-going.
- [x] Web: types + `carpoolClient` mapping.
- [x] Web: dual-chip helpers (`coverageCopy` / `rideStatusChip` /
      `carpoolDisplay` / `coverageQueue` as needed) + component tests.
- [x] Web: wire Focus, AgendaRow (and Carpool ride lines / week-glance if they
      share the same helpers) to dual chips; keep round-trip actions working;
      not-going refresh shows cleared legs.
- [x] Docs: `docs/architecture.md` → Team carpool space (detail) Rides /
      Clients / Out of scope (+ RSVP/transport clear note).
- [x] Tests: run backend carpool (+ RSVP coupling) tests + web unit tests for
      touched helpers / surfaces; report results.

## Open questions

_None blocking._ Deliberate risk: coverage responsibility rows stay orthogonal
until `carpool-ride-coverage-card` unifies the default card write path; this
slice must still keep today’s round-trip Confirm / Ask / Accept dogfoodable via
leg slots. Per-kid distinct plans are explicitly deferred to
`carpool-kid-split-plans` without blocking twins/triplets on the default shared
plan.
