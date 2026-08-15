# Spec: Agenda Focus card (design slice)

Status: done  
Created: 2026-08-14  
Updated: 2026-08-15 (`/pr`)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-card`  
Added: 2026-08-14 · enhancement  

Scope: web client only. iOS/Android explicitly out of scope for this slice.

## Objective

Promote exactly one Agenda item — the one that most needs the adult's
attention — into a visually distinct "Focus card" at the top of Agenda, while
every other item keeps its current flat/spacing-only treatment. This
supersedes the "Selection A — spacing only" rule in
`docs/agenda-coverage-web-contract.md` for the promoted item only; all
business logic (coverage, RSVP, busy states, field-row rules) is unchanged.

Full rationale and the exact rule being superseded:
`docs/agenda-focus-card-addendum.md` (already in repo — read it before
starting).

## Pre-req: files already added to the repo

These five files already exist at the paths below. Do not regenerate their
contents — read them, understand them, and wire them up.

- `design-tokens/tokens.json` (replaced — new color/radius/typography values;
  WCAG AA amendment 2026-08-14: light `textSecondary` `#686F79`, `danger`
  `#A9590C`, `success` `#187D58`; dark `danger` remains `#F2994A`)
- `docs/agenda-focus-card-addendum.md` (new)
- `web/src/components/coverageDisplay.ts` (new)
- `web/src/components/agendaFocusSelection.ts` (new)
- `web/src/components/AgendaFocusCard.tsx` (new)

## Tasks

### 1. [x] Regenerate platform tokens

Run:

```bash
node design-tokens/generate.mjs
node design-tokens/generate.mjs --check
```

Confirm `web/src/styles/tokens.generated.css`,
`mobile/sharedUI/.../ui/UiTokens.kt`, and `mobile/iosApp/iosApp/UiTokens.swift`
are all rewritten and the `--check` run passes clean. Commit the regenerated
files alongside `tokens.json` — they must never drift from it.

`tokens.json` is the adopted palette after the 2026-08-14 WCAG AA amendment
(light `textSecondary` `#686F79`, `danger` `#A9590C`, `success` `#187D58`;
dark `danger` remains `#F2994A`). Do not restore the first-pass light hex
values.

### 2. [x] Deduplicate helpers in `web/src/components/FamilyScreen.tsx`

`coverageDisplay.ts` re-implements several functions that currently exist
inline in `FamilyScreen.tsx`: `coverageStatusLabel`, `coverageAdultLabel`,
`coverageKidNames`, `eventKidNames`, `calendarSourceLabel`,
`calendarItemKey`, `memberLabel`.

- Delete the local definitions of these from `FamilyScreen.tsx`.
- Import them instead from `@/components/coverageDisplay`.
- Confirm no behavior changes — these are 1:1 ports, not rewrites. Diff the
  old inline implementation against `coverageDisplay.ts` if anything looks
  different before deleting.

### 3. [x] Wire in the Focus card

In the Agenda section of `FamilyScreen.tsx`, immediately before the
`visibleCalendarItems.map(...)` that renders the flat agenda list:

```tsx
import { selectFocusItem } from "@/components/agendaFocusSelection"
import { AgendaFocusCard } from "@/components/AgendaFocusCard"

// ...inside the component, before the existing .map():
const focusItem = selectFocusItem(visibleCalendarItems)
const restItems = visibleCalendarItems.filter((i) => i !== focusItem)
```

- Render one `<AgendaFocusCard />` above the list when `focusItem` is not
  null, passing it the **same** per-item state and handlers the flat list
  already computes for that item (`coverageAssignState(item, itemKey)`,
  `onAssignCoverage`, `onConfirmCoverage`, `onDeclineCoverage`,
  `onRemoveCoverage`, `onSetCalendarLeaveFrom`, `onSetCalendarRsvp`,
  `setDestination("places")` for Open Places, `openEditEvent`,
  `onRemoveEvent`, and `coverageActionErrors[itemKey]`). Do not duplicate or
  re-derive this state — pass through what the component already computes
  for that item today.
- Change the existing `.map()` to iterate over `restItems` instead of
  `visibleCalendarItems`.
- `focusItem` must never appear twice on screen (card + flat row). Verify
  with the item's `data-testid` — `agenda-focus-{source}-{id}` should be the
  only rendered instance when that item is the focus item.

### 4. [x] Update `docs/agenda-coverage-web-contract.md`

- In the "Presentation hierarchy" section, add a note directly under the
  "Selection A" heading: `Superseded for the Focus card item only — see
  docs/agenda-focus-card-addendum.md. Flat items below the Focus card still
  follow Selection A unchanged.`
- Do not delete or rewrite Selection A itself — it still governs every
  non-focus item.
- Add "Focus card selection + rendering" as a new row in the "Port checklist"
  table, status "web only — not yet ported," so iOS/Android tracking isn't
  silently dropped.

### 5. [x] Tests

Find and update (search for `agenda`, `FamilyScreen`, `coverage`, in test
files):

- Any test asserting a specific item renders as a flat row that will now be
  the focus item — update the assertion to look for
  `agenda-focus-{source}-{id}` instead of the flat-row testid, or adjust
  fixture data so the test's target item isn't the one selected by
  `selectFocusItem`.
- Add a new test for `selectFocusItem` (in `agendaFocusSelection.ts` or
  adjacent `.test.ts`) covering: (a) earliest conflicted/uncovered item wins
  over a calmer earlier item, (b) all-RSVP-No items are never selected, (c)
  empty agenda returns `null`, (d) all-attending-all-covered agenda returns
  the earliest item.
- Add a test confirming a focus-selected item does not also render in the
  flat list (no duplicate testid).
- Run the full web test suite; fix any other breakage from the helper
  dedup in step 2 — these should be behavior-preserving, so failures likely
  indicate a real mismatch between the old inline logic and
  `coverageDisplay.ts`, not just a snapshot diff to update blindly.

### 6. [x] Manual smoke test before calling this done

- Load Agenda with a conflicted/uncovered item present — confirm it renders
  as the Focus card, not a flat row.
- Resolve that conflict (assign coverage) — confirm the card either updates
  in place or a new focus item is selected on next render, and the resolved
  item doesn't stay stuck in Focus card state incorrectly.
- Load Agenda with no conflicts/uncovered items — confirm the earliest
  attending item still gets Focus card treatment with "All set" styling
  (success color, not danger).
- Load Agenda where every item is RSVP `NO` — confirm no Focus card renders
  and no crash.
- Toggle light/dark — confirm `--fc-danger`/`--fc-success`/`--fc-accent`
  colors on the card follow the new `tokens.json` values in both modes.

## Explicitly out of scope

- iOS and Android implementations of the Focus card (tracked in the contract
  doc's port checklist as not-yet-ported).
- Font family change (`typography.fontFamily` stays `system-ui` — a real
  font swap needs font assets bundled per platform, tracked separately).
- Any change to coverage/RSVP/busy-state business rules — this slice is
  visual only.

## Acceptance criteria

- [x] `node design-tokens/generate.mjs --check` passes with no diff after
      running generate.
- [x] Exactly one Agenda item renders as a Focus card at a time; never zero
      when at least one attending item exists, never more than one.
- [x] No duplicate rendering of the focus item in the flat list.
- [x] Full test suite passes; new tests from step 5 are present and passing.
- [x] `docs/agenda-coverage-web-contract.md` updated per step 4.
- [x] Manual smoke test checklist above completed.
