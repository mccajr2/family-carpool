# Spec: coverage-confirm-decline

Status: done  
Created: 2026-08-07  
Updated: 2026-08-12 (implemented; archived)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `coverage-confirm-decline`  
Added: 2026-08-07 · re-rank split

## Problem

Adults see a unified Agenda and leave-by estimates, but the circle still cannot
**assign who is responsible for which kid(s) on an event**, or get an explicit
**confirm / decline**. Without that, households juggle permutations (one car to
one game, split across conflicts, nanny driving, two cars for teammates) in
chat — and later conflict detection has no coverage intent to reason about.

Separately, leave-by’s default origin is “first located place by name,” which
feels like combobox order. Adults need a **stable personal default leave-from**
(usually Home) with per-item overrides for exceptions.

## Non-goals

- **Conflict detection / amber Agenda** — `conflict-detection` (next slice;
  uses this coverage model for adult double-books)
- **Carpool / seats / teammate rides / nonplayer kids in the car** — garage +
  carpool slices; coverage is **responsibility**, not a trip plan
- **Vehicle on the coverage row**; “attending but not covering anyone”
- **Push / email** when assigned or when someone declines
- **Auto-assign** algorithms
- **Leave-from on the coverage assignment** — reuse leave-by leave-from
  (default + per-item override)
- **Activity-type arrival lead times** — `event-arrival-lead-time`
- Restyling Calendar onto shared UI tokens (`ui-system-destination-adoption`)
- OpenAPI codegen — hand-written clients stay the pattern

## Approach

### Domain split (locked)

| Concern | Answers | This PR |
|--------|---------|---------|
| **Coverage** | Who in our circle is responsible for which of our kids on this event? | Yes |
| **Leave-from / leave-by** | Where does *this adult* leave from for *this item*? | Default leave-from yes; per-item override already ships |
| **Carpool / trip** | Driver, seats, teammates, nonplayers | No |

### Coverage model (locked)

`CoverageAssignment`:

| Field | Notes |
|-------|--------|
| id | UUID |
| calendar item | `source` (`MANUAL` \| `FEED`) + `itemId` |
| coveringAdultId | Circle member |
| kidIds | Non-empty subset of that item’s `kidIds` |
| status | `PENDING` \| `CONFIRMED` \| `DECLINED` |
| assignedByAdultId | Who created/last reassigned |
| timestamps | created/updated |

**Invariants:**

- **Many rows per item** (different adults / kid sets).
- **Each kid on an item appears on at most one active coverage row**
  (`PENDING` or `CONFIRMED`). `DECLINED` does not hold the kid.
- **One adult may cover many kids** on one item (single row).
- **Any circle member may assign or reassign** (pick adult + kid subset).
- **Assigned adult confirms or declines.** If assigner === assignee → status
  starts **`CONFIRMED`** (no busywork). Otherwise **`PENDING`** until that
  adult acts.
- **Reassign** (change adult and/or kids) by any member: replace/update row;
  if covering adult changes and is not the assigner → back to `PENDING`.
- **Decline:** set `DECLINED`; those kids become uncovered (eligible for a new
  assignment). Do not auto-pick someone else.
- **Uncovered kids** (on the item’s `kidIds` but not on any PENDING/CONFIRMED
  row): clients show a clear “needs coverage” cue — no auto-assign.
- Invalid kid id / kid not on item / adult not in circle → **400** / **404**
  as appropriate; overlapping kid with another active row → **409**.

No vehicle, seats, leave-from, or nonplayer fields on the row.

### Default leave-from (locked)

Per **adult** (circle membership): optional `defaultLeaveFromPlaceId` → a
**located** circle place.

Leave-by origin resolution order:

1. Per-item leave-from override (existing)
2. Adult’s **default** leave-from, if set and still located
3. Else first located place by name (legacy fallback — avoid relying on it in UI copy; prompt to set a default when none)

Any member sets **their own** default (Places or Family settings control).
Clearing default is allowed. Setting a non-located place → **400**.

### Module / API shape

- New Modulith module **`coverage`**: persistence + assign/confirm/decline
  rules; public API for `calendar` enrichment.
- **`leaveby`**: read adult default when resolving origin (family exposes
  default place on membership / small public port).
- **`family`**: store default leave-from on membership (or equivalent);
  GET circle / me includes current adult’s default; PATCH to set/clear.
- **`calendar`**: enrich each Agenda item with **coverage summaries** visible
  to all members (not only the signed-in adult). Compose only — no coverage
  internals imported into other modules’ internals.

**Contract (OpenAPI bump; web + Android + iOS same change):**

- Extend `CalendarItem` with coverage list (e.g. assignments: id, adult id/name,
  kidIds, status) and/or derived uncoveredKidIds.
- Endpoints (names flexible at implement time), any member unless noted:
  - Create / update / remove coverage assignment on
    `/api/family/circle/calendar/{source}/{itemId}/coverages…`
  - Confirm / decline **own** pending assignment (assignee only → else **403**)
- Default leave-from: get via circle payload; `PATCH` (or Places-adjacent) to
  set/clear own default.

### Clients (web + Android + iOS)

**Web reference (stable):** [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
— layout, busy indicators, Edit-only manual controls, sole-option assign/leave-from,
coverage copy, and port checklist. Port iOS then Android to that contract; do not
fork UX.

High-level (all clients):

- Agenda row: coverage lines (adult + kids + pending/confirmed) and **needs
  coverage** when any item kid is uncovered.
- Assign UI (pick adult + kids when needed; sole options implicit); confirm /
  decline when the signed-in adult has a `PENDING` row.
- Set **My default leave-from** (located places only); leave-by picker remains
  for per-item exceptions when there are multiple located places.

### Docs

Update `docs/architecture.md`: coverage module + invariants; leave-by default
origin order; explicit hand-off that seats/nonplayers/trips → carpool.

## Acceptance criteria

- [x] OpenAPI bumped; coverage fields on `CalendarItem` + assign/confirm/decline
      (+ remove) endpoints documented; default leave-from get/set documented;
      web + Android + iOS clients updated in the same change.
- [x] Any member can assign an adult + non-empty kid subset on a calendar item;
      self-assign → `CONFIRMED`; assign other → `PENDING`.
- [x] Assignee can confirm (`CONFIRMED`) or decline (`DECLINED`); non-assignee
      confirm/decline → **403**. Declined kids count as uncovered.
- [x] Kid exclusivity: second active assignment claiming the same kid on the
      same item → **409**. Kid not on item / empty kidIds → **400**.
- [x] Reassign by any member updates the row; covering-adult change to someone
      else → `PENDING`.
- [x] `GET …/calendar` includes coverage for all members; uncovered kids are
      detectable by clients; calendar GET never fails solely because coverage
      is empty.
- [x] Adult can set/clear **default leave-from** to a located circle place;
      leave-by uses override → default → legacy first-located-by-name.
- [x] No conflict amber UI; no vehicle/seats/nonplayers on coverage.
- [x] `ModularityTests` green; unit + integration tests for assign/confirm/decline,
      exclusivity, authz, and default leave-from resolution.
- [x] `docs/architecture.md` updated (coverage + default origin order).

## Tasks

- [x] **Backend (`family`):** Persist per-membership default leave-from; PATCH
      (+ expose on circle/me); validate located place; public port for leaveby.
- [x] **Backend (`leaveby`):** Origin resolution uses default before
      first-located-by-name fallback; tests.
- [x] **Backend (`coverage`):** Module + migration; assignment entity/repo;
      assign/reassign/remove/confirm/decline rules; public API for calendar.
- [x] **Backend (`calendar`):** Enrich agenda items with coverage; wire write
      endpoints (controller in calendar or coverage — keep Modulith boundaries).
- [x] **Contract:** OpenAPI coverage + default leave-from; version bump.
- [x] **Web:** Agenda coverage + needs-coverage; assign/confirm/decline;
      default leave-from control; client + tests.
- [x] **Android (`sharedLogic` / `sharedUI`):** Same surfaces + tests.
- [x] **iOS:** Same surfaces + tests.
- [x] **Docs:** `docs/architecture.md`.
- [x] **Tests:** Service unit + API integration; ModularityTests.

## Open questions

None blocking — locked in `/spec` discussion:

| Topic | Decision |
|--------|----------|
| Assign / confirm | Any member assigns; assignee confirms/declines; self-assign auto-confirmed |
| Leave-from on coverage row | No — reuse leave-by |
| Default leave-from | Per-adult located place; then per-item override; legacy name sort last |
| Cardinality | Many assignments/item; kid exclusive on active rows; multi-kid per adult OK |
| Carpool / seats / nonplayers | Out — later slices |
| Conflicts UI | Out — `conflict-detection` next |
