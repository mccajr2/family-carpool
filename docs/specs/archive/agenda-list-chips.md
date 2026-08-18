# Spec: agenda-list-chips

Status: archived  
Completed: 2026-08-18  
Created: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-list-chips`  
Added: 2026-08-17 · enhancement

Scope: **web Calendar Agenda only** — kid-filter chips + collapsed `AgendaRow`
summary chrome. No OpenAPI, backend, iOS, or Android. Same filter,
expand/collapse, coverage, RSVP, and leave-by handlers — presentation only.

## Problem

The Agenda kid filter still uses shadcn **Button** chrome (`default` / `outline`).
Collapsed list rows still use a separate 9px status dot plus **`AgendaStatusChip`
`appearance="tag"`** (uppercase) even though
[`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md) ([#52](https://github.com/mccajr2/family-carpool/pull/52))
already shipped shared `agendaItemStatusTags` and pill styling on Focus.

The Calendar light mock (2026-08-17 intake) shows **filter chips**, **Title
Case status pills** with a leading dot (same language as the polished Focus
card), **covering-adult avatar(s)** when coverage is confirmed, and a
token-aligned trailing chevron — not button/text tags.

## Non-goals

- New kid-filter semantics (still **All kids** + one kid at a time, client-side
  on the loaded window)
- Changing expanded-row bands, coverage writes, RSVP, leave-by, or Focus
  selection ([`agenda-focus-next-action`](../archive/agenda-focus-next-action.md))
- Focus card changes ([`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md)
  shipped in #52) — **reuse** `AgendaStatusChip` + `agendaItemStatusTags` only
- A **“N stops”** / **“3 STOPS”** tag ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Week-at-a-glance rail ([`agenda-week-glance`](../planned/agenda-week-glance.md))
- Destination page header ([`web-shell-page-header`](../archive/web-shell-page-header.md))
- iOS / Android ([`agenda-full-page-redesign-mobile`](../planned/agenda-full-page-redesign-mobile.md))

## Approach

**No contract change.**

**Base branch:** `main` including
[`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md)
([#52](https://github.com/mccajr2/family-carpool/pull/52)) — shared
`AgendaStatusChip` + `agendaItemStatusTags` already exist. This slice switches
collapsed rows from `appearance="tag"` to `appearance="pill"` (`variant="default"`)
and adds filter chips + avatars; do not re-touch Focus layout.

**Visual source:** Calendar light screenshot — filter chip row + **Rest of today**
/ **Tomorrow** collapsed cards. Measure size, weight, spacing, and color from the
mock; add or update roles in `design-tokens/tokens.json` in the same PR
(`docs/ui-system.md`). Do **not** snap filter padding or avatar diameter to
nearby existing roles.

### 1. Collapsed-row status (reuse #52 helpers)

Keep `agendaItemStatusTags(item, currentAdultId, { outOfPlay })` — precedence
is already centralized in `coverageDisplay.ts` (see
[`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)).
Do **not** invent new labels or reorder precedence. List rows do not pass
`includeAllSet: true` (Focus only).

### 2. Kid-filter chips (`FamilyScreen.tsx`)

Replace shadcn `Button` filters with a small **`AgendaKidFilterChip`**
component (colocated under `web/src/components/`):

- **All kids** + one chip per kid (`kid.displayName`)
- Selected chip: mock-aligned filled accent treatment; unselected: quiet
  border/fill (measure from mock — not `Button` `default`/`outline`)
- Same state + handlers: `agendaKidFilter`, `setAgendaKidFilter`, disabled
  while calendar status is loading
- Keep `role="group"`, `aria-label="Filter agenda by kid"`,
  `data-testid="agenda-kid-filter"`
- Chip row gap/wrap from mock tokens (`filterChip*` roles)

### 3. Collapsed `AgendaRow` summary

Restyle the collapsed header only; expanded bands unchanged:

- **Status pills:** render `agendaItemStatusTags` via `AgendaStatusChip`
  (`appearance="pill"`) — Title Case + leading dot, bordered fill (same
  visual language as Focus polish / mock `.status-pill`). Retire uppercase
  `text-[11px] font-bold uppercase` inline tags.
- **Drop the standalone 9px left dot** when pills are shown — the pill’s
  leading dot + tone carry state (mock does not duplicate dot + pill).
- **Covering avatar(s):** when the item has at least one **CONFIRMED**
  coverage row and is in play, show a circular initials badge for the
  covering adult(s) on the collapsed summary (mock shows at least one).
  - Initials via existing `accountInitials(displayName, email)`; resolve
    email from `circle.members` by `coveringAdultId`.
  - **v1:** show the first confirmed covering adult; if the mock shows a
    second stacked avatar for multi-coverage, add up to **two** overlapping
    badges — measure offset from mock (`listRowAvatar*` tokens).
  - Omit avatars for pending-only, uncovered, and out-of-play rows.
  - `aria-label` e.g. `Covering: {name}`; decorative duplicate of chip text
    is OK — avatar is the mock’s quick scan cue.
- **Chevron:** replace literal `›` with semantic `icon.chevron` (existing
  token icon), mock-sized, rotates on expand. Keep `aria-expanded` on the
  row toggle button.

Layout: title/time still wrap — no `truncate` / `nowrap` on the primary
column (`docs/agenda-full-redesign-addendum.md`).

Regenerate tokens (`node design-tokens/generate.mjs` + `--check`).

## Context

Allowlist for `/implement` — do not load the rest of `docs/`.

- Design: [`docs/ui-system.md`](../../ui-system.md) (mocks → tokens)
- Coverage / status labels: [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
  (filter chrome + `agendaItemStatusTags` precedence — do not invent labels)
- List wrap / no truncate: [`docs/agenda-full-redesign-addendum.md`](../../agenda-full-redesign-addendum.md)
- Source: `web/src/components/FamilyScreen.tsx`, `AgendaRow.tsx`,
  `agendaStatusChip.tsx`, `AgendaKidFilterChip.tsx`, `coverageDisplay.ts`
- Pill API already on `main` via #52 — read `agendaStatusChip.tsx`, not the
  archived polish spec, unless the component is unclear

## Acceptance criteria

- [x] Kid filter renders as mock-aligned **chips**, not shadcn Buttons; selecting
      All kids / a kid name filters the agenda exactly as today (including Focus
      + list).
- [x] Collapsed rows render **pill** status chips (Title Case + leading dot) from
      `agendaItemStatusTags` — including **Confirm coverage** and **Awaiting
      confirm** cases — not uppercase inline tags.
- [x] Confirmed in-play rows show a **covering-adult avatar** (initials) on the
      collapsed summary; uncovered / pending-only / out-of-play rows do not.
- [x] Standalone 9px status dot removed from collapsed rows; state reads from pills.
- [x] Trailing expand chevron uses `icon.chevron` and mock token sizing.
- [x] Mock-measured filter-chip and row-avatar type/spacing locked in
      `tokens.json` and consumed via `--fc-*` vars (no raw px/hex in components).
- [x] Expanded `AgendaRow` bands, Focus card behavior, and all write handlers
      unchanged.
- [x] `cd web && npm test`, `npm run lint`, and
      `node design-tokens/generate.mjs --check` pass.

## Tasks

- [x] **Tokens:** measure Calendar light filter row + collapsed list cards; add
      `filterChip*` and `listRowAvatar*` (and pill spacing if list pills ≠ Focus
      pills); regenerate + WCAG AA on new text/fill pairings.
- [x] **Web:** `AgendaKidFilterChip` + swap filter row in `FamilyScreen.tsx`.
- [x] **Web:** `AgendaRow.tsx` collapsed summary — switch to
      `AgendaStatusChip` `appearance="pill"`, add avatars + chevron; remove 9px
      dot and default (`tag`) chip styling.
- [x] **Tests:** update `AgendaRow.test.tsx` (pill not uppercase; confirm/await
      tags; avatar when confirmed); `FamilyScreen.test.tsx` kid-filter cases;
      chip/avatar unit tests as needed.
- [x] **Docs:** touch `docs/agenda-coverage-web-contract.md` Layout filter bullet
      (chips not buttons); optional one-line note in
      `docs/agenda-full-redesign-addendum.md` that collapsed rows use pill chips
      + avatars.

## Open questions

None — Calendar light screenshot is the intake reference (2026-08-17). If mock
px conflict with an older token lock, defer to the mock per `docs/ui-system.md`.
