# Spec: web-shell-page-frame

Status: done  
Created: 2026-08-17  
Updated: 2026-08-17 (`/pr` amend: mock grid `1fr` + main `max-width: 820px`)  
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

**Circle-ready layout (`md+`).** CSS grid on the signed-in shell, matching the
Calendar mock:

| Column | Width | Role |
|--------|--------|------|
| Rail | `15rem` / `md:w-60` (240px) | Existing aside; still `sticky top-0 h-svh` |
| Main track | `1fr` (`minmax(auto, 1fr)`) | Grows; **content min** is the floor (do not `min-w-0` / `minmax(0, 1fr)` / `min-w-[820px]`) |
| Context | `20rem` / `md:w-80` (320px) | **Calendar only.** Empty chrome: left border from `--fc-border`, padding from existing space tokens. `aria-label="Context"`. No heading, no week-strip copy, no carpool card |

`.main` is the grid item (same as the mock): `max-width: 820px`,
`justify-self: start`. The **track** is still `1fr` so leftover space sits
between Agenda and the Context aside (context docks to the viewport right).
820px is a **max**, not a min. Padding: nearest existing `--fc-space-*`
(do not add 28/36/44px roles). Narrow stacks (`min-w-0` on main only below
`md`).

**Narrow.** Rail stacks above content (`min-h-svh` as today). **Do not**
render the context aside. Do not `position: fixed` a third pane over Agenda.

**Other destinations (Carpool / Family / Places / Garage / Feeds).** Two
columns only: rail + uncarded main. Same handlers.

No contract changes.

Intake (measurements only, not copy): Calendar mock HTML 2026-08-17
`grid-template-columns: 240px 1fr 320px`.

## Acceptance criteria

- [x] Signed-out Sign in (and FamilyScreen create/join/loading/error Cards)
      still use the centered `max-w-5xl` column. Circle-ready signed-in UI
      does **not**.
- [x] `md+`: rail is flush to the viewport left at `md:w-60` (not `md:w-56`,
      not inside `max-w-5xl`). Still `sticky top-0 h-svh`, `rail*` chrome
      unchanged.
- [x] Destination column is uncarded (no shell `Card` border/shadow). `.main`
      `max-w-[820px]` inside a `1fr` track (`justify-self: start`); no
      `min-w-[820px]`. Destinations and `setDestination` / `onSignOut`
      handlers unchanged.
- [x] Calendar `md+` shows an empty `aside` labelled Context (`w-80`, left
      border). No week-glance or carpool-card copy. Tests must **not** assert
      “Week at a glance” or stop-list strings.
- [x] Context aside is absent on Carpool / Family / Places / Garage / Feeds
      and absent below `md`. Caregiver Calendar still gets the empty aside
      (Feeds omission unchanged).
- [x] Web tests: AuthScreen/App signed-out wrapper; FamilyScreen frame
      (rail width, no shell Card, Calendar context present/absent). Existing
      sidebar destination tests still pass. `npm test` + `npm run lint` in
      `web/`.

## Tasks

- [x] Web: `App.tsx` drops `max-w-5xl`; `AuthScreen` signed-out (and
      FamilyScreen empty/loading/error Cards) keep the centered column.
- [x] Web: circle-ready `FamilyScreen` — `md` grid, rail `md:w-60`, uncarded
      main with `max-w-[820px]`, Calendar-only Context aside (`md:w-80`).
- [x] Tests: AuthScreen/App layout; FamilyScreen frame + destination
      presence/absence of Context; no wordmark-string or week-glance-string
      assertions. Run `npm test` + `npm run lint` in `web/`.

## Open questions

None. Mock `.shell` is `grid-template-columns: 240px 1fr 320px`; `.main` is
`max-width: 820px` only. The middle floor is grid `1fr` = `minmax(auto, 1fr)`
(content min), not 820px. Empty Context chrome vs filling it is the split
with `agenda-week-glance`. Destination header type, Calendar Today/date copy,
ink/slate colors, and header↔content gap are deferred to
[`web-shell-page-header`](../planned/web-shell-page-header.md) — not this
slice.
