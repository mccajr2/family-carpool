# Spec: conflict-detection

Status: done  
Created: 2026-08-07  
Updated: 2026-08-12 (`/pr`)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `conflict-detection`  
Added: 2026-08-07 · re-rank split

## Problem

Households often have the same kid on two overlapping practices/games (feeds
they don’t control), or the same adult tentatively covering two overlapping
events. Without a clear **amber** signal on the Agenda, conflicts stay buried
in chat. Separately, two **CONFIRMED** coverages for one adult on overlapping
events must be impossible — detection after the fact is too late.

## Non-goals

- **Travel / leave-by “cutting it close” soft warn** — follow-up
  [`conflict-travel-margin`](../planned/conflict-travel-margin.md)
- **Client calendar cache / background refresh** — follow-up
  [`calendar-client-cache`](../active/calendar-client-cache.md) (Next up after
  this PR; conditional GET split to `calendar-conditional-get`)
- Push / email for conflict alerts (`push-notifications`)
- Auto-resolve, auto-reassign, or merge/split of coverage rows
- Changing coverage CRUD semantics beyond the **409** guard on creating a
  second overlapping CONFIRMED
- Month/week grid conflict chrome (`family-calendar-grid`)
- Restyling Calendar onto shared UI tokens (`ui-system-destination-adoption`) —
  conflict chrome may use a provisional warning color if no token exists yet
- OpenAPI codegen — hand-written clients stay the pattern

## Approach

### Overlap (locked)

Intervals use event **`startsAt` / `endsAt` only** (not leave-by or travel).

- Treat each item as half-open `[startsAt, end)` where `end = endsAt` if set,
  else `end = startsAt` (zero-length / point event).
- Two items **overlap** when `A.startsAt < B.end && B.startsAt < A.end`.
- Same calendar item never conflicts with itself.

### Kid conflict (amber only)

If the same **kid** appears on two overlapping items (any sources), both items
get an amber **kid time-overlap** conflict. Creation of overlapping events is
**allowed** (feeds / manual schedules are not blocked).

### Adult coverage conflict (amber + hard guard)

Active coverage = status **`PENDING` or `CONFIRMED`** (`DECLINED` ignored).

| Situation | Behavior |
|-----------|----------|
| Same adult has active coverage on two overlapping items, and **at least one** is PENDING (PENDING+PENDING, PENDING+CONFIRMED) | **Amber** adult coverage conflict on both items |
| Action would leave the same adult with **two CONFIRMED** coverages on overlapping items | **409** — refuse the action |

**409 applies to** any write that would produce two CONFIRMED overlaps for that
adult, including:

- `POST …/coverages/{id}/confirm`
- Assign / reassign / create that **auto-CONFIRMs** (self-assign)

Assigning a **PENDING** row onto an adult who already has CONFIRMED (or PENDING)
on an overlapping item remains **allowed** (amber). Declining or removing
coverage clears the conflict when no longer matching the rules.

### Server owns the rules (OpenAPI)

Do **not** re-implement overlap logic in clients for “truth.” Backend:

1. Enriches `GET /api/family/circle/calendar` (and coverage mutation responses
   that return `CalendarItem`) with a **`conflicts`** list per item.
2. Enforces the CONFIRMED double-book **409** in the coverage module (calendar
   compose may call a small public port).

**Suggested conflict payload** (names flexible at implement time):

- `type`: `KID_TIME_OVERLAP` | `ADULT_COVERAGE_OVERLAP`
- For kid: `kidId` (+ display name if already the pattern elsewhere)
- For adult: `adultId` (+ display name)
- `otherSource` + `otherItemId` (+ optional `otherTitle` / `otherStartsAt` for
  Agenda copy without a second fetch)

Conflict peers may lie **outside** the requested `from`/`to` window if they
overlap an in-range item — still include them on the in-range item’s
`conflicts` list. The **409** check uses the full circle schedule, not only the
current Agenda page.

### Module shape

- Prefer detection + enrichment in **`calendar`** (or a tiny dedicated helper
  used by calendar), reading event times via existing calendar merge and
  coverage via public `CoverageApi`.
- **409** guard lives with coverage writes (confirm / assign paths) so invalid
  CONFIRMED states cannot be persisted.
- No new Modulith module required unless implement finds a clean split;
  do not put conflict rules inside `feeds` or `events` internals.

### Clients (web + Android + iOS)

- Render amber conflict chrome on Agenda **items** that have non-empty
  `conflicts` (attach to the item — primary band or a single status line; **no**
  new control dump / banner stack). Follow Interaction UX tenets
  ([`calendar-ux-flow`](../archive/calendar-ux-flow.md)).
- Short human copy: kid overlap vs adult coverage overlap (use titles / names
  from payload when present).
- On **409** from confirm/self-assign: keep prior state; show a clear error
  (adult already confirmed on an overlapping event) — do not retry as success.
- Update [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
  for conflict chrome + 409 copy (web remains the reference; mobile matches).

## Acceptance criteria

- [x] OpenAPI: `CalendarItem` includes a `conflicts` array (typed kid vs adult
      overlap + peer item identity); version bumped; web + Android + iOS clients
      updated in the same change.
- [x] `GET …/calendar` marks both items when the same kid is on two
      overlapping events (amber data present even if no coverage exists).
- [x] `GET …/calendar` marks both items for adult **PENDING+PENDING** and
      **PENDING+CONFIRMED** coverage on overlapping events.
- [x] Confirm (or self-assign auto-confirm) that would create **CONFIRMED+CONFIRMED**
      on overlapping events returns **409** and leaves assignments unchanged.
- [x] Assigning **PENDING** coverage onto an adult who already has active
      coverage on an overlapping item succeeds (200) and surfaces amber.
- [x] `DECLINED` coverage does not participate in adult conflict detection or
      the 409 guard.
- [x] Overlap uses event start/end only (null `endsAt` → zero-length at
      `startsAt`); leave-by / travel gaps do **not** create conflicts in this PR.
- [x] Agenda (web + Android + iOS) shows amber conflict affordance on items with
      conflicts; no auto-resolve UI; 409 confirm/self-assign shows a clear error.
- [x] Unit + integration tests cover kid overlap, adult amber cases, 409
      double-CONFIRMED, DECLINED ignored; `ModularityTests` still passes.
- [x] Architecture + agenda web contract note conflict enrichment and the
      CONFIRMED guard; roadmap Active → Done when shipped.

## Tasks

- [x] Backend: conflict detection helper; enrich calendar GET (+ item-returning
      coverage responses); 409 on confirm / auto-confirm paths that would
      double-CONFIRMED; tests
- [x] Contract: OpenAPI `conflicts` on `CalendarItem` (+ any ErrorResponse code
      clarity for coverage 409); bump version
- [x] Web: client types; Agenda amber chrome; 409 handling; agenda web contract
- [x] Android: sharedLogic + Agenda amber + 409
- [x] iOS: Agenda amber + 409
- [x] Docs: `docs/architecture.md` Calendar/Coverage rows; roadmap on `/pr`
- [x] Tests: backend unit/integration as above; client unit tests for rendering /
      409 messaging where the repo already tests Agenda chrome

## Open questions

_None blocking — travel soft-warn and client cache are separate planned ids._
