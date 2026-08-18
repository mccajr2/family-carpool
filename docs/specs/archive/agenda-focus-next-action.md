# Spec: agenda-focus-next-action

Status: done  
Created: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-next-action`  
Added: 2026-08-17 · enhancement

Scope: **web Focus selection only** (`selectFocusItem` + the Focus card’s
urgent vs all-set predicate). No OpenAPI, backend, iOS, or Android. Chrome
layout stays [`agenda-focus-card-polish`](../planned/agenda-focus-card-polish.md).

## Problem

The Focus card is supposed to be the adult’s **most important next action**.
Shipped `selectFocusItem` picks the earliest uncovered or conflicted item in
the whole loaded window, so a 3-week-out RSVP/uncovered event steals the hero
from tonight’s practice. The addendum’s “today, then tomorrow, then this week”
wording was never implemented — and “this week” was too broad: Friday coverage
must not beat being on time today.

## Non-goals

- Focus card chrome / ring layout / type
  ([`agenda-focus-card-polish`](../planned/agenda-focus-card-polish.md))
- iOS / Android ([`agenda-focus-card-mobile`](../planned/agenda-focus-card-mobile.md)
  copies this rule later)
- Ride request / accept / decline as a Focus candidate
  ([`agenda-focus-carpool-actions`](../planned/agenda-focus-carpool-actions.md)
  after [`carpool-request-accept`](../active/carpool-request-accept.md))
- Coverage, RSVP, or leave-by **write** rules; conflict computation
- Promoting more than one Focus card
- Skipping events that already started today (same loaded list as now)
- New status-line copy beyond not calling a pending-confirm item “All set”
- OpenAPI / backend

## Approach

**No contract change.**

Keep exactly one Focus item. Change **which** item, in
`web/src/components/agendaFocusSelection.ts`, and keep
`FamilyScreen` wiring (`focusItem` / `restItems`) as-is.

**Day buckets** reuse the same boundaries as `groupAgendaByDay` (Today /
Tomorrow / This week / Later). Export helpers (`startOfLocalDay`, bucket
classifiers, `weekEnd`) from `agendaDayGroups.ts` so Focus, day groups, and
later [`agenda-week-glance`](../planned/agenda-week-glance.md) cannot drift.
Inject `now` into `selectFocusItem` (default `new Date()`) so tests freeze the
clock.

**Needs a decision** (shared helper, used by selection **and**
`AgendaFocusCard` urgent vs resolved surface):

- `uncoveredKidIds.length > 0` (RSVP no-response kids are already uncovered), or
- `conflicts.length > 0`, or
- `pendingCoverageForAdult(item, currentAdultId)` is present

Pass `currentAdultId` from `FamilyScreen` (`adult?.id`). Empty id → pending
confirm does not match.

**Ranking** (in-play items only — `isAgendaItemOutOfPlay` unchanged):

1. Earliest in-play item that **needs a decision** and falls in **Today**.
2. Else earliest in-play item that **needs a decision** and falls in
   **Tomorrow**.
3. Else the **earliest in-play item** — the next event to leave for / attend,
   even when all-set (including far-future).
4. Else none (empty or all RSVP No).

**Why not “earliest needs-decision this week”?** Coverage for Friday matters
less than being on time for today’s practice. Rest-of-week decisions (This week
bucket, days 3–6) stay in the flat list and will surface in the week-at-a-glance
strip — they must **not** steal Focus from a sooner all-set event.
[`agenda-week-glance`](../planned/agenda-week-glance.md) is the per-day rollup
(“1 needs coverage”, “All set”); Focus stays the single **next physical action**.

Examples:

- All-set tonight + uncovered in 3 weeks → tonight (step 3; Later bucket).
- All-set tonight + uncovered Friday (same week) → tonight (step 3; week
  glance will flag Friday).
- All-set tonight + uncovered tomorrow → tomorrow (step 2).
- Only event is Friday uncovered → Friday (step 3).

`AgendaFocusCard` must use the same needs-decision helper so a pending-confirm
hero is not the resolved / “All set” surface. Do not invent new status copy:
existing conflict line, else uncovered names, else the existing
`"Needs coverage"` fallback.

## Acceptance criteria

- [x] Frozen `now`: all-set today + uncovered tomorrow → tomorrow Focus (step 2).
- [x] Frozen `now`: all-set today + uncovered Friday (same week) → today Focus;
      Friday stays a flat row (step 3 beats rest-of-week decision).
- [x] Frozen `now`: all-set tonight + uncovered in 3 weeks → tonight (step 3;
      Later bucket).
- [x] Frozen `now`: pending coverage confirm for the signed-in adult **today**
      or **tomorrow** wins over an earlier all-set item in that window; pending
      for someone else does not (unless that item is also uncovered/conflicted).
      Pending confirm on a rest-of-week item does not beat a sooner all-set
      event.
- [x] All-RSVP-No items are never selected; empty list returns `null`; all
      in-play all-set returns the earliest.
- [x] `AgendaFocusCard` urgent surface follows the same needs-decision helper
      (pending-for-self is not “All set”).
- [x] `FamilyScreen` still renders exactly one Focus card (or none); no
      duplicate `agenda-focus-*` + `agenda-item-*` for the same id.
- [x] Horizon math matches `groupAgendaByDay` (shared helper). No OpenAPI
      change.
- [x] `cd web && npm test` and `npm run lint` pass. The 2030-dated
      “uncovered later wins” Agenda test uses dates inside the horizon
      (relative to `now` or `vi.setSystemTime`). `earlierFocusDecoy` may stay
      earliest-in-play.

## Tasks

- [x] Web: extract shared day-bucket helpers from `agendaDayGroups.ts` (Today /
      Tomorrow / weekEnd); rewrite `selectFocusItem(items, now, currentAdultId)`
      ranking; pass `now` + `adult?.id` from `FamilyScreen`.
- [x] Web: export `focusItemNeedsDecision` (or equivalent); `AgendaFocusCard`
      uses it instead of inline uncovered/conflicts.
- [x] Docs: replace the addendum selection list with this ranking (today/tomorrow
      decisions, else next in-play; rest-of-week via list + week glance). Note
      pending-for-self on the urgent surface. Port checklist still says
      iOS/Android must match web.
- [x] Tests: extend `agendaFocusSelection.test.ts` for the AC cases (inject
      `now` + adult id). Fix `FamilyScreen.test.tsx` Focus assertions that
      assumed unbounded uncovered-wins (2030-08-15 vs 16). Add a card test that
      pending-for-self is not the all-set surface.
- [x] Tests: `cd web && npm test` and `npm run lint`; fix real regressions.

## Open questions

None — day buckets match `groupAgendaByDay`; rest-of-week status is
[`agenda-week-glance`](../planned/agenda-week-glance.md), not Focus. Ride
actions stay parked.

## Future extension (not this PR)

[`agenda-focus-carpool-actions`](../planned/agenda-focus-carpool-actions.md)
extends this slice after [`carpool-request-accept`](../active/carpool-request-accept.md).
The same shape holds: composable **needs-decision** predicates + **horizon
tiers**, still exactly one Focus card.

Planned direction (lock in that spec, not here):

- **Today / tomorrow** — unchanged: circle RSVP, coverage, conflicts, pending
  confirm for self; always beat a sooner all-set leave-for event.
- **Carpool coordination** — insert a tier **after** tomorrow, **before** step 3
  (next in-play): pending ride **accept/decline for self**, or “your kid still
  needs a teammate ride” when no circle coverage exists. Use a **longer horizon**
  (likely full “this week”, possibly farther) so teammates get lead time — external
  coordination is higher leverage earlier than internal Friday coverage planning.
- **Step 3** — still the next in-play event to leave for when no tier above
  matched; on-time today never hidden by rest-of-week *coverage* gaps.

Week glance can show per-day driver/ride rollups alongside coverage; Focus stays
the single next action.
