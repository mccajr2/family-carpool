# Spec: web-shell-page-frame

Status: done  
Created: 2026-08-17  
Updated: 2026-08-17 (`/pr` amend: `.main` max 820 only, implicit min-content)  
Approved: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `web-shell-page-frame`  
Added: 2026-08-17 · enhancement

Scope: **web signed-in page frame only.** Destinations, handlers, and rail
row chrome stay as [`web-shell-nav-rail`](../archive/web-shell-nav-rail.md).
No OpenAPI, backend, iOS, or Android.

## Problem

The always-dark rail shipped, but signed-in UI still lives inside `App.tsx`’s
centered `max-w-5xl mx-auto px-4 py-10` column. The rail is inset and
`md:w-56` (224px), not flush-left ~240px. Destination content is a bordered
`Card` with leftover gap, so Agenda sits too far right. The Calendar mock’s
right column has no home — week-glance **content** is a later slice; this
slice only makes room for it.

## Non-goals

- Filling the right rail (`agenda-week-glance`, parked `carpool-multi-stop`
  stop list + Open in Maps)
- Destination restyles (Focus card, chips, Feeds, Family / Places / Garage,
  Carpool)
- Changing destination set, order, or click handlers
- iOS / Android (bottom tabs stay)
- Signed-out auth **and** signed-in create/join/loading/error empty Cards
  (keep today’s centered column)
- A three-column dashboard on every destination, or a required third column
  at narrow width (product non-goal: desktop-first UX)
- New spacing/color token roles for mock px that are 4–8px off the scale
- Rail row restyle (idle/selected type, icons, ACCOUNT footer) — already
  shipped

## Approach

**Signed-out vs signed-in shell.** Move the centered `max-w-5xl` wrapper off
`App.tsx` (App is `min-h-svh w-full` only). `AuthScreen` signed-out return
keeps that centered column. `FamilyScreen` create/join/loading/error Cards
keep it too (wrap those returns). Circle-ready signed-in UI is full viewport.

**Circle-ready layout.** CSS grid on the signed-in shell, matching the
Calendar mock (no stacked breakpoint — the mock has none):

| Column | Width | Role |
|--------|--------|------|
| Rail | `w-60` (240px) | Always docked `sticky top-0 h-svh` — **not** `w-full min-h-svh` |
| Main track | `1fr` (`minmax(auto, 1fr)`) | Shrinks with the window. Floor is default `min-width: auto` (min-content of `.main`’s contents — about half of 820 in the mock). No `min-w-0` / `minmax(0, 1fr)` / `min-w-[820px]` / shell `min-w-min` |
| Context | `w-80` (320px) | **Calendar only**, always in this grid. Empty chrome: left border from `--fc-border`. `aria-label="Context"` |

`.main` is the grid item (same as the mock): **`max-width: 820px` only** —
no `width: 100%`, no `min-width`, no `justify-self`. Default stretch fills
the `1fr` track up to 820; leftover space sits between Agenda and Context.
The floor is implicit min-content, not 820. Padding: nearest existing
`--fc-space-*`. Nowrap / `truncate` inside `.main` (Agenda titles) raises
that floor to ~820, so the column never follows `1fr` down — titles wrap,
like the mock `.row-main`. `App` is a `div`, not a nested `<main>`.

**Do not** switch to a column stack that paints the dark rail across the
viewport. That is what made the page go black while dragging the window in.

**Other destinations (Carpool / Family / Places / Garage / Feeds).** Two
columns only: rail + uncarded main. Same handlers.

No contract changes.

Intake (measurements only, not copy): Calendar mock HTML 2026-08-17
`grid-template-columns: 240px 1fr 320px`.

## Acceptance criteria

- [x] Signed-out Sign in (and FamilyScreen create/join/loading/error Cards)
      still use the centered `max-w-5xl` column. Circle-ready signed-in UI
      does **not**.
- [x] Signed-in rail is always `w-60` + `sticky top-0 h-svh` (not `w-full`,
      not inside `max-w-5xl`). `rail*` chrome unchanged.
- [x] Destination column is uncarded. `.main` `max-w-[820px]` only (no
      `w-full`, no `min-w-0`, no `min-w-[820px]`) inside a `1fr` track.
      Destinations and handlers unchanged.
- [x] Calendar shows an empty Context aside (`w-80`, left border) in the
      grid at all widths. No week-glance copy. Absent on other destinations.
      Caregiver Calendar still gets it.
- [x] Web tests: AuthScreen/App signed-out wrapper; FamilyScreen frame
      (rail width, no shell Card, Calendar context present/absent). Existing
      sidebar destination tests still pass. `npm test` + `npm run lint` in
      `web/`.

## Tasks

- [x] Web: `App.tsx` drops `max-w-5xl`; `AuthScreen` signed-out (and
      FamilyScreen empty/loading/error Cards) keep the centered column.
- [x] Web: circle-ready `FamilyScreen` — always-on mock grid (`15rem 1fr
      20rem`), rail `w-60`, uncarded main `max-w-[820px]`, Calendar Context
      `w-80`.
- [x] Tests: AuthScreen/App layout; FamilyScreen frame + destination
      presence/absence of Context; no wordmark-string or week-glance-string
      assertions. Run `npm test` + `npm run lint` in `web/`.

## Open questions

None. Mock `.shell` is `grid-template-columns: 240px 1fr 320px`; `.main` is
`max-width: 820px` only (no min-width, no width). The floor is default
`min-width: auto` = min-content of the panel’s contents. Empty Context
chrome vs filling it is the split with `agenda-week-glance`. Destination
header type, Calendar Today/date copy, ink/slate colors, and header↔content
gap are deferred to
[`web-shell-page-header`](../planned/web-shell-page-header.md) — not this
slice.
