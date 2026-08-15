# Spec: Agenda full page redesign

Status: ready for implementation  
Created: 2026-08-15  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-full-page-redesign`  
Added: 2026-08-15 · enhancement

Scope: web client only, Agenda destination only. iOS/Android and other
destinations (Carpool, Family, Places, Garage, Feeds) explicitly out of
scope — separate roadmap items.

## Relationship to prior work — READ THIS FIRST

This builds on an **already-implemented** prior spec (Agenda Focus card) plus
the `hero*` spotlight upgrade ([`agenda-focus-hero-surface`](agenda-focus-hero-surface.md)).
Do not recreate, rewrite, or revert any of the following — they are done
and stay exactly as they are:

- `design-tokens/tokens.json` (including all `hero*` roles)
- `web/src/components/AgendaFocusCard.tsx`
- `web/src/components/agendaFocusSelection.ts`
- `web/src/components/coverageDisplay.ts`
- `docs/agenda-focus-card-addendum.md`

This spec only adds new files and edits the flat-list portion of
`FamilyScreen.tsx` — the part below the Focus card. The Focus card itself
is untouched.

`FamilyScreen.tsx` already uses `selectFocusItem` / `restItems` / one
`<AgendaFocusCard />` — that wiring matches this spec. Do not re-derive it.

## Objective

Replace the entire flat/spacing-only agenda list (everything below the
Focus card) with day-grouped, card-styled, expandable rows. Fully retires
"Selection A — spacing only" from `docs/agenda-coverage-web-contract.md` —
not a second carve-out, a full replacement. Rationale and exact new rules:
`docs/agenda-full-redesign-addendum.md` (already in repo — read before
starting).

## Pre-req: files already added to the repo

- `web/src/components/agendaDayGroups.ts` (new)
- `web/src/components/AgendaRow.tsx` (new)
- `docs/agenda-full-redesign-addendum.md` (new)

## Tasks

### 1. Wire day-grouping + AgendaRow into FamilyScreen.tsx

Where the Agenda section currently does:

```tsx
const focusItem = selectFocusItem(visibleCalendarItems)
const restItems = visibleCalendarItems.filter((i) => i !== focusItem)
// ...restItems.map(item => <flat row JSX>)
```

Change the `restItems` rendering to:

```tsx
import { groupAgendaByDay } from "@/components/agendaDayGroups"
import { AgendaRow } from "@/components/AgendaRow"

const dayGroups = groupAgendaByDay(restItems)
```

Render each group with a section header (label + optional dateLabel) above
a stack of `<AgendaRow />`, one per item, passing the **same** per-item
props the flat list already computes today (`coverageAssignState(item,
itemKey)`, `onAssignCoverage`, `onConfirmCoverage`, `onDeclineCoverage`,
`onRemoveCoverage`, `onSetCalendarLeaveFrom`, `onSetCalendarRsvp`,
`setDestination("places")`, `openEditEvent`, `onRemoveEvent`,
`coverageActionErrors[itemKey]`) — this is the same pass-through pattern
used when `AgendaFocusCard` was wired in; do not re-derive this state.

Remove the old flat-row JSX entirely once `AgendaRow` covers the same
content (verify against the "Port checklist" style comparison in task 4 below
before deleting — don't delete blind).

### 2. Section header component (inline is fine — no new file required)

Simple heading per non-empty group: `label` (e.g. "Tomorrow") plus, if
present, `dateLabel` (e.g. "Aug 14") in secondary text. No new file needed
unless you find yourself repeating markup 3+ times — your call on inline vs
extracted.

### 3. Confirm no content regression

Before deleting the old flat-row JSX, diff what it rendered against what
`AgendaRow` renders for the same item — every field, tag, and action that
existed in the old flat row must exist in `AgendaRow`, either visible in the
collapsed summary or behind the expand toggle. The one intentional
exception: no "N stops" carpool tag (see addendum — not implemented,
no data source, not a regression).

### 4. Update `docs/agenda-coverage-web-contract.md`

- Remove the "Selection A — spacing only" section and its superseded-by
  addendum-1 note entirely.
- Replace with a pointer: "Agenda presentation hierarchy is now governed by
  `docs/agenda-full-redesign-addendum.md` (flat rows) and
  `docs/agenda-focus-card-addendum.md` (the promoted item). This section is
  retired."
- Everything else in the contract doc (Coverage, RSVP, Busy/loading
  indicators, Field rows, Port checklist) stays — this is a presentation
  change, not a behavior change.
- Update the Port checklist: add a row "Full Agenda row redesign
  (day-grouping, card rows, expand/collapse)" status "web only — not yet
  ported," same pattern as the Focus card row already there.

### 5. Tests

- Add tests for `groupAgendaByDay`: items split correctly across
  Today/Tomorrow/This week/Later boundaries using local calendar days (not
  UTC); empty buckets omitted; items with an unparseable `startsAt` land in
  "Later" rather than crashing.
- Add a test confirming an out-of-play item renders muted with only the
  "Not going" tag and no coverage/travel content when expanded.
- Add a test confirming expand/collapse toggles the detail bands without
  affecting other rows' state.
- Update/remove any existing tests written against the old flat-row markup
  structure — same caution as before: a failure here likely means real
  content is missing from `AgendaRow`, not just a stale selector.
- Run the full suite; fix real regressions, don't just update snapshots to
  match new output without checking the diff makes sense.

### 6. Manual smoke test

- Agenda with items spanning today/tomorrow/this week/further out — confirm
  correct grouping and that group headers only appear when non-empty.
- Expand a row, confirm it shows the same detail as the item currently
  shows in production (coverage, RSVP, leave-from) — nothing lost.
- Collapse it, expand a different row — confirm independent state, no
  cross-row leakage.
- An out-of-play (all-RSVP-No) item — confirm muted styling and that it
  never gets promoted to the Focus card either (should already hold, this
  just re-confirms it after the row redesign).
- Confirm the Focus card above the list still renders and functions
  exactly as before — this spec must not change it.

## Explicitly out of scope

- Carpool multi-stop screen and its "N stops" tag dependency.
- Family / Places / Garage / Feeds destinations.
- iOS / Android.
- Any change to `AgendaFocusCard.tsx`, `tokens.json`, `agendaFocusSelection.ts`,
  or `coverageDisplay.ts` — all already shipped, all untouched by this spec.

## Acceptance criteria

- [ ] Agenda list below the Focus card is day-grouped; empty groups don't render.
- [ ] Every item renders as a collapsed `AgendaRow` card by default.
- [ ] Expand/collapse works per-row, independently, with no lost functionality
      versus the old flat row (verified per task 3).
- [ ] Out-of-play items render muted with only a "Not going" tag.
- [ ] `docs/agenda-coverage-web-contract.md` updated per task 4.
- [ ] Full test suite passes; new tests from task 5 present and passing.
- [ ] Focus card behavior/appearance unchanged.
- [ ] Manual smoke test checklist completed.
