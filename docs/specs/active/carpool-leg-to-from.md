# Spec: carpool-leg-to-from

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Updated: 2026-09-09 (`/spec` — five Calendar ride-state surfaces)  
Added: 2026-08-14 · enhancement  
Branch: `carpool-leg-to-from`

## Problem

v1 ride requests are household-scoped and always mean **both** legs. Families
often need a ride **to** practice but not **from** (or the reverse), and
siblings on the same event can need different legs or different drivers. The
current “one request = all kids = both legs” shape cannot express that without
special cases, and it blocks later multi-family passenger lists and per-leg
meet points.

## Non-goals

- **Multi-circle passengers on one `Ride`** (dad + teammate kid on the same TO
  leg) — [`carpool-multi-family-ride`](../planned/carpool-multi-family-ride.md)
- **Progressive disclosure UI** (“Different plans for each way?” / “Same driver
  both ways?” split editor) —
  [`carpool-leg-split-plans`](../planned/carpool-leg-split-plans.md)
- **Where a leg starts/ends** (home / school / teammate house) and route-stop
  insertion — [`carpool-meet-at`](../planned/carpool-meet-at.md) (`meetPoint` is
  a nullable placeholder only in this PR)
- Early/late windows — [`carpool-early-late-window`](../planned/carpool-early-late-window.md)
- Stop-order optimize — [`carpool-route-optimize`](../planned/carpool-route-optimize.md)
- Claim→confirm handshake beyond today’s immediate accept (`CLAIMED` collapsed
  into `CONFIRMED`)
- Expo / push / KMP UI or `sharedLogic` OpenAPI updates (KMP frozen)
- Carpool tab visual restyle — [`carpool-page-redesign`](../planned/carpool-page-redesign.md)
- Changing coverage semantics (coverage stays orthogonal to seats/trips)
- **Accept only a subset of legs** on an inbound round-trip ask (leg picker on
  Accept) — [`carpool-leg-split-plans`](../planned/carpool-leg-split-plans.md)
- **FROM-only / return-trip Route view** (homeward stops). Destination Route
  tab stays TO-bound; meet-at stop insertion stays
  [`carpool-meet-at`](../planned/carpool-meet-at.md)

## Approach

Remodel carpool so a **need** (`CarpoolRequest`) is separate from a
**fulfillment** (`Ride`). Extend the existing Modulith `carpool` module; HTTP
stays under `/api/carpool/*`. **OpenAPI changes** (bump `info.version`): split
today’s household `CarpoolRide` request/accept resource into request + ride
schemas/paths; update hand-written **web** clients in the same change (not
KMP).

### Domain

**`CarpoolRequest` — need (one row per kid × event × circle)**

| Field | Notes |
|--------|--------|
| id | UUID |
| spaceId, eventKey, kidId, circleId | Uniqueness key (not household-as-bag) |
| legsNeeded | Set of `TO` \| `FROM` — never store `BOTH`; expand any input convenience immediately |
| meetPointTo / meetPointFrom | Nullable placeholders for `carpool-meet-at`; unused this PR |
| createdByAdultId | Who created/last expanded the need |
| pickup snapshot | Still requester-house name+address (meet-at deferred) |

Siblings are independent requests. `circle` groups for UI only.

**`Ride` — fulfillment (one row per driver × leg × event)**

| Field | Notes |
|--------|--------|
| id | UUID |
| spaceId, eventKey | |
| leg | Strictly `TO` \| `FROM` (never `BOTH`) |
| driverAdultId, drivingCircleId, vehicleId | |
| passengers | Non-empty list of `CarpoolRequest` ids |

Round-trip duty = **two** `Ride` rows. A kid’s leg is covered when their
request id is a passenger on an active `Ride` for that `(eventKey, leg)`.

**This PR’s passenger rule:** all `passengers` on a `Ride` must belong to the
**same requesting circle**. Cross-circle passengers →
`carpool-multi-family-ride`.

### Conflict / uniqueness

- **409** creating a second `CarpoolRequest` for existing
  `(space, eventKey, kid, circle)`. Change needs via **PATCH** `legsNeeded`.
- **409** adding a request’s leg as passenger on a second active `Ride` for
  that leg.
- Vehicle: at most one active `Ride` per `(vehicle, eventKey, leg)` (TO and
  FROM may both exist).

### Status (derived; no independent stored request status)

Per leg in `legsNeeded`:

| LegStatus | Meaning |
|-----------|---------|
| `OPEN` | Needed, not a passenger on any active `Ride` for that leg |
| `CONFIRMED` | Passenger on an active `Ride` for that leg |

Roll-up on the request (list/hero copy):

| status | When |
|--------|------|
| `FULLY_COVERED` | Every leg in `legsNeeded` is `CONFIRMED` |
| `PARTIAL` | At least one `CONFIRMED` and at least one `OPEN` |
| `UNCOVERED` | No leg `CONFIRMED` |

`PARTIAL` is first-class in API + UI. Cancelling/withdrawing one leg’s `Ride`
does not cascade to the other leg.

### API shape (locked for this PR)

- Create/list/PATCH **requests** (needs); create/list/cancel/withdraw **rides**
  (fulfillments). Accepting an inbound teammate ask = create a `Ride` for the
  chosen leg(s) with that request as passenger (same-circle passenger rule
  still holds for the ride’s passenger set — a teammate ride typically has
  one other-circle request).
- Household driver assignment uses the same `Ride` create path (driver may be
  in the requesting circle). Driver picker remains generic: self, other
  household adult, or teammate — do not assume “other leg = other family.”
- Create convenience: client may send `legs: TO | FROM | BOTH` (or
  `legsNeeded` set); server persists only the set. Default for new needs =
  `{TO, FROM}` (round trip).
- Seat math on ride create/accept: `remaining = vehicle.seats − 1 −
  (driver circle’s YES kids on event already on this Ride) − passengers`;
  succeed only when `remaining >= 0` after adding the new passenger(s). Prefer
  attaching multiple same-circle kids in one accept when the UI batches them;
  still one `Ride` per leg.
- Pass (soft decline) stays per-adult on an **OPEN** inbound request (not on
  `Ride`).
- Successful teammate accept still sets RSVP YES for kids on that request
  (existing behavior). Coverage stays orthogonal.

### Migration

Flyway (or equivalent) migrates existing v1 rows: one household both-legs
request with N kids → N `CarpoolRequest`s with `legsNeeded={TO,FROM}`; if
`ACCEPTED`, create `Ride` TO + `Ride` FROM with the same driver/vehicle and
all N request ids as passengers (same circle). Dogfood data must remain
readable.

### Web UI — five Calendar ride-state surfaces (same PR)

Default path only. Reuse existing tokens/components — **not** a Carpool
restyle (`carpool-page-redesign`). Do **not** ship the “Different plans…”
editor (`carpool-leg-split-plans`).

Shared mappers (`coverageQueue`, `carpoolDisplay`, `coverageDisplay`,
`rideStatusChip`, `canRoute`, `agendaWeekGlanceDays`) must treat per-kid
requests + per-leg rides + roll-up `UNCOVERED` | `PARTIAL` | `FULLY_COVERED`.
Kids clear from the **coverage gap** only when their need is
`FULLY_COVERED` (or household confirmed covers every leg in `legsNeeded`) —
**never** on `PARTIAL` alone. v1 `ACCEPTED` ≡ today’s `FULLY_COVERED`.

#### Request control (create / PATCH needs)

On Request (Agenda / Focus / Carpool), one control per kid need:

```
Ride needed:  ○ To practice   ○ From practice   ● Round trip   (default: Round trip)
```

- Round trip → `legsNeeded={TO,FROM}`; To / From → single-member set.
- Changing needs after create uses PATCH `legsNeeded` (same control).

#### Accept / Cancel / Withdraw (locked this PR)

- **Accept** (Hero inbound slide + expanded `AgendaInboundRequestRow` +
  Carpool): one action covers **all still-OPEN legs** on that ask for the
  chosen vehicle/driver — creates one `Ride` per OPEN leg (round trip → two
  rows when both OPEN). No leg picker on Accept.
- **Household DriverPicker** assign that covers both needed legs → two
  `Ride`s when `legsNeeded={TO,FROM}` and one driver takes both.
- **Cancel** (own need) / **Withdraw** (accepted-by-us): target a **specific
  `Ride` id** (one leg). Other leg unchanged. After a one-leg cancel,
  roll-up becomes `PARTIAL` or `UNCOVERED` as derived.
- **Pass** stays per-adult soft decline of an OPEN inbound **request** (not
  per Ride).
- Preferred: group same-circle OPEN kids with **matching** `legsNeeded` into
  one Accept that creates one `Ride` per leg with multiple passengers (not
  multi-family merge).

#### 1. Hero card (`HeroAttentionCarousel` / `HeroAttentionSlide` /
`AgendaFocusCard`)

- Request To / From / Round trip on own-gap slides; partial status copy on the
  slide when roll-up is `PARTIAL`.
- Queue: own kid stays in `getQueue` while any needed leg is `OPEN` (including
  `PARTIAL`); leave queue only when `FULLY_COVERED` or otherwise no decision
  (same spirit as today’s confirmed / requested-wait rules).
- Inbound Accept / Pass as above; outline Cancel / Withdraw remain reachable
  when those states are shown — Withdraw/Cancel one leg does not remove the
  other.

#### 2. Normal agenda card (`AgendaRow` + `AgendaInboundRequestRow`)

- Collapsed + expanded: same Request control; expanded inbound Accept / Pass /
  Withdraw; own Cancel; DriverPicker when assigning.
- Expanded ride-line density still matches Carpool tab via `carpoolDisplay`
  (who / where / kids / seats) — show per-leg fulfillment when two rides
  exist (e.g. TO confirmed, FROM open) without opening split-plans UI.

#### 3. Status chips (`rideStatusChip.ts` → Focus + collapsed AgendaRow)

Partial copy is the **own-ride chip label** (Feeds uppercase presentation),
not only body text. Examples:

| Roll-up / state | Chip direction |
|-----------------|----------------|
| `UNCOVERED`, no ask yet | **Ride needed** (amber) |
| Open team ask, none confirmed | **Asked the team** (amber) |
| `PARTIAL` round trip | **Round trip — from confirmed, to still needed** (or swapped) — amber |
| `PARTIAL` with household driving one leg | Prefer driving / riding chip for the confirmed leg **plus** keep urgency for the open leg via queue/hero; collapsed chip may use the partial string when that is the most urgent own-ride signal |
| `FULLY_COVERED` household | **You're driving** / **You're driving · +N** (route tone when riders) |
| `FULLY_COVERED` teammate | **Riding with {circle}** (mint) |

Precedence unchanged: Overlaps → commitment conflict → own-ride → …  
Carpool-ask count chip unchanged (counts actionable inbound requests).

#### 4. Week at a glance (`AgendaWeekGlance` / `agendaWeekGlanceDays`)

- Remaining gap kids: subtract only kids whose need is `FULLY_COVERED` (not
  `PARTIAL`, not open ask).
- Day with any in-play event that still has remaining gap → **needs coverage**
  (flagged). No new “partial” week-glance string this PR.
- Wire the same join as Agenda rows (`ownRequestForItem` / per-kid needs).

#### 5. Route view (`canRoute` → ride detail / `RideRouteTab`)

- `canRoute` is true when the kid has a **confirmed TO** fulfillment
  (household `Ride` with `leg=TO`, or teammate covering the TO leg) and
  attendance is in play.
- `PARTIAL` with TO confirmed → route entry **on**; FROM still open does not
  block destination Route.
- TO still `OPEN` → route entry **off** (nothing to drive to the venue yet).
- FROM-only confirmation alone does **not** open destination Route.
- No homeward/FROM Route tab this PR; no meet-at stop insertion.

### Architecture / contract docs

Update in the same PR:

- `docs/architecture.md` → **Team carpool space (detail)** (Rides / Clients)
- `docs/agenda-coverage-web-contract.md` — remaining-gap / week-glance language
  from v1 `ACCEPTED` to `FULLY_COVERED` / `PARTIAL` rules above
- Locked decision **Carpool request** on the roadmap when this ships (`/pr`)

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → **Family circle (v1)** (coverage vs
  carpool)
- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Rides / Clients rows — rewrite target)
- Web contract: `docs/agenda-coverage-web-contract.md` → **Loaded window** /
  **Hero carousel queue**, **Coverage** (remaining gap + chips), **Week at a
  glance**, **Ride-state surface set**
- Archived (reuse): `docs/specs/archive/carpool-request-accept.md` (v1 loop,
  seat math, Pass/Cancel/Withdraw, pickup snapshot)
- Archived (reuse): `docs/specs/archive/household-driver-assignment.md`
  (DriverPicker; household vs team ask)
- Archived (reuse): `docs/specs/archive/unified-ride-status-chip.md` (chip
  helpers / tones)
- Archived (reuse): `docs/specs/archive/ride-detail-shell.md` (`canRoute` gate)
- Contract: `contracts/openapi.yaml` → tag `carpool` (`CarpoolRide`,
  `CreateCarpoolRideRequest`, `/api/carpool/spaces/{spaceId}/rides`)
- Backend: `backend/modules/carpool/` (`CarpoolController`,
  `CarpoolRideService`, `CarpoolRideRequestEntity`, repositories)
- Web: `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`
- Web: `web/src/components/carpoolDisplay.ts`, `coverageQueue.ts`,
  `coverageDisplay.ts`, `rideStatusChip.ts`, `canRoute.ts`,
  `agendaWeekGlanceDays.ts`, `DriverPicker.tsx`, `CarpoolPanel.tsx`,
  `HeroAttentionSlide.tsx`, `HeroAttentionCarousel.tsx`, `AgendaFocusCard.tsx`,
  `AgendaRow.tsx`, `AgendaInboundRequestRow.tsx`, `AgendaWeekGlance.tsx`,
  `RideRouteTab.tsx`, `FamilyScreen.tsx` (create/accept/cancel/withdraw +
  ride-detail entry)
- Sibling stubs (boundaries only): `docs/specs/planned/carpool-multi-family-ride.md`,
  `docs/specs/planned/carpool-leg-split-plans.md`,
  `docs/specs/planned/carpool-meet-at.md`

Do not list `docs/roadmap.md` or the entire architecture file.

## Acceptance criteria

- [ ] OpenAPI documents **CarpoolRequest** (need) and **Ride** (fulfillment)
      separately; `legsNeeded` is a set of `TO`/`FROM` (no persisted `BOTH`);
      `Ride.leg` is `TO`|`FROM`; bump `info.version`; web clients updated in the
      same change.
- [ ] Create request: one row per kid; default `legsNeeded={TO,FROM}`; accept
      `TO`/`FROM`/`BOTH` input convenience and expand on write; duplicate
      `(space, eventKey, kid, circle)` → **409**; PATCH `legsNeeded` to change
      needs.
- [ ] Create/accept ride: one `Ride` per `(driver, leg, event)`; passengers are
      request ids from **one** circle; second active passenger assignment for
      the same request leg → **409**; round-trip coverage = two rides.
- [ ] Derived leg status `OPEN`|`CONFIRMED` and request roll-up
      `UNCOVERED`|`PARTIAL`|`FULLY_COVERED` appear on list/detail responses;
      cancelling one leg’s ride leaves the other leg unchanged.
- [ ] Existing Pass / Cancel / Withdraw / seat-capacity / own-circle vs
      teammate rules still enforce correctly under the new resources (mapped
      in Approach). Accept covers all still-OPEN legs; Cancel/Withdraw are
      per-`Ride`.
- [ ] DB migration converts v1 household both-legs rows into per-kid requests
      (+ two rides when previously accepted) without losing dogfood rides.
- [ ] Web Request UI: per-kid To / From / Round trip (default Round trip) on
      Agenda / Focus / Carpool; no split-plans disclosure UI; no Accept leg
      picker.
- [ ] **Hero:** partial status on slide; own OPEN/`PARTIAL` stays queued;
      Accept/Pass/Cancel/Withdraw per Approach.
- [ ] **Agenda card:** collapsed + expanded (`AgendaRow` /
      `AgendaInboundRequestRow`) Request + reverse actions; per-leg ride lines
      when TO/FROM differ.
- [ ] **Status chips:** `rideStatusChip` emits partial round-trip chip copy;
      gap clears only on `FULLY_COVERED`.
- [ ] **Week at a glance:** `PARTIAL` still counts as needs coverage; only
      `FULLY_COVERED` clears remaining gap kids.
- [ ] **Route:** `canRoute` true iff confirmed **TO** for that kid; `PARTIAL`
      with TO confirmed allows Route; FROM-only does not; no FROM Route tab.
- [ ] `meetPoint*` fields exist as null placeholders; no meet-at behavior.
- [ ] Unit + integration tests cover uniqueness, per-leg confirm, partial
      roll-up, migration of a sample v1 row, and web helpers for chips / week
      glance / `canRoute` / queue that would fail if partial/leg logic were
      reverted.
- [ ] Docs: architecture Team carpool space + agenda-coverage-web-contract
      remaining-gap / week-glance language updated for `FULLY_COVERED` /
      `PARTIAL`.

## Tasks

- [x] Contract: split OpenAPI carpool ride schemas/paths into request + ride;
      bump version
- [x] Backend: entities/repos/services for `CarpoolRequest` + per-leg `Ride`;
      uniqueness, passenger conflict, status derivation
- [x] Backend: Flyway migration from v1 household `CarpoolRideRequest` shape
- [x] Backend: map create/accept/cancel/withdraw/pass/list to new model; seat
      math per leg; same-circle passenger enforcement; Accept = all OPEN legs
- [x] Backend: integration tests for AC above
- [x] Web: update `carpoolClient` + types
- [x] Web: Request UI To/From/Round trip on Agenda/Focus/Carpool create paths
- [x] Web: `coverageQueue` / `coverageDisplay` / `carpoolDisplay` mappers for
      per-kid / per-leg / `PARTIAL` (gap clears only on `FULLY_COVERED`)
- [x] Web: `rideStatusChip` partial + covered/ask labels; Focus + AgendaRow
- [x] Web: Hero (`HeroAttentionSlide` / carousel / Focus) Request + Accept all
      OPEN legs + per-Ride Cancel/Withdraw; queue keeps `PARTIAL`
- [x] Web: `AgendaRow` + `AgendaInboundRequestRow` parity with Hero Accept/
      Cancel/Withdraw; per-leg ride-line density
- [x] Web: `agendaWeekGlanceDays` remaining-gap uses `FULLY_COVERED` only
- [x] Web: `canRoute` TO-confirmed gate; ride-detail entry unchanged otherwise
- [x] Web: DriverPicker / accept flows create per-leg `Ride`s (two rows for
      round trip when one driver covers both)
- [x] Docs: `docs/architecture.md` → Team carpool space (detail)
- [x] Docs: `docs/agenda-coverage-web-contract.md` gap / week-glance /
      Ride-state surface set wording
- [ ] Tests: unit tests for `rideStatusChip`, `agendaWeekGlanceDays`,
      `canRoute`, queue/display helpers that would fail if partial/leg logic
      were reverted

## Open questions

- Exact URL layout (`/requests` + `/rides` vs nested) — implementer picks the
  clearest OpenAPI shape; keep space-scoped and Bearer-auth’d.
- Exact partial chip string when household is driving TO and FROM is still
  open (partial sentence vs **You're driving** + separate urgency) —
  prefer the Approach table; implementer may use the partial string whenever
  it is the single most urgent own-ride chip.
