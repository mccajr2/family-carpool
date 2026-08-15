# Spec: Agenda Focus card hero* surface

Status: done  
Created: 2026-08-15  
Updated: 2026-08-15 (`/pr`)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-hero-surface`  
Added: 2026-08-15 · enhancement

Scope: web Focus card visual upgrade + shared token roles. iOS/Android chrome
out of scope (port still [`agenda-focus-card-mobile`](../planned/agenda-focus-card-mobile.md)).

## Problem

The shipped web Focus card uses theme-following `surfaceRaised` /
`danger` / `success`. Urgent items need a theme-independent `hero*` spotlight
surface (dark card on light pages; a lighter/more saturated card in dark
mode) plus a decorative countdown ring. That design exists in the redesign
intake; it did not land with `agenda-focus-card`.

## Non-goals

- Day-grouping / `AgendaRow` / retiring Selection A (`agenda-full-page-redesign`)
- Feeds, Carpool, Family / Places / Garage
- iOS / Android Focus card chrome
- Changing selection logic, coverage/RSVP/leave-by handlers, or copy
- Reconstructing `agendaFocusSelection.ts` or `coverageDisplay.ts`

## Approach

Overwrite three intake files verbatim, then regenerate platform tokens:

- `design-tokens/tokens.json` — add `heroSurface`, `heroOn`,
  `heroOnSecondary`, `heroDanger`, `heroSuccess`, `heroAccent`
- `web/src/components/AgendaFocusCard.tsx` — urgent vs resolved surfaces +
  countdown ring
- `docs/agenda-focus-card-addendum.md` — hero* rules

`hero*` pairings are WCAG AA (4.5:1 text, 3.0:1 `heroAccent` as icon/ring).
Do not use `hero*` outside the Focus card’s urgent state.

## Acceptance criteria

- [x] The three files match the redesign intake (not a paraphrase).
- [x] `node design-tokens/generate.mjs --check` passes after generate.
- [x] `hero*` pairings in `design-tokens/contrast.test.mjs` meet WCAG AA.
- [x] Urgent Focus card uses `heroSurface`; resolved/"all set" uses
      `surfaceRaised`.
- [x] Handlers/copy unchanged; web tests pass.

## Tasks

- [x] Overwrite `tokens.json`, `AgendaFocusCard.tsx`, and the addendum from
      the intake.
- [x] Run `node design-tokens/generate.mjs` then `--check`.
- [x] Extend contrast + token declaration tests for `hero*` roles.
- [x] Add a Focus card test: urgent vs resolved surface tokens; handlers
      still fire.
- [x] Run web tests + token tests; fix real regressions.

## Open questions

None — intake files are the source of truth.

