# Spec: web-shell-page-frame

Status: in-progress  
Created: 2026-08-17  
Updated: 2026-08-17  
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

**Circle-ready layout (`md+`).** CSS grid (or equivalent flex) on the signed-in
shell:

| Column | Width | Role |
|--------|--------|------|
| Rail | `md:w-60` (240px, mock) | Existing aside; still `sticky top-0 h-svh` |
| Main | `1fr` / `min-w-0` | Destination; **not** a `Card` (no `border` / `shadow-sm` / raised fill) |
| Context | `md:w-80` (320px) | **Calendar only.** Empty chrome: left border from `--fc-border`, padding from existing space tokens. `aria-label="Context"`. No heading, no week-strip copy, no carpool card |

Main inner measure matches the mock: content `max-w-[820px]` so Agenda stays
left-of-center on ultrawide; the **column** is still `1fr` so the context
aside docks to the viewport right. Padding: nearest existing `--fc-space-*`
(do not add 28/36/44px roles).

**Narrow.** Rail stacks above content (`min-h-svh` as today). **Do not**
render the context aside. Do not `position: fixed` a third pane over Agenda.

**Other destinations (Carpool / Family / Places / Garage / Feeds).** Two
columns only: rail + uncarded main. Same handlers.

No contract changes.

Intake (measurements only, not copy): Calendar mock HTML 2026-08-17
`grid-template-columns: 240px 1fr 320px`.

## Acceptance criteria

- [ ] Signed-out Sign in (and FamilyScreen create/join/loading/error Cards)
      still use the centered `max-w-5xl` column. Circle-ready signed-in UI
      does **not**.
- [ ] `md+`: rail is flush to the viewport left at `md:w-60` (not `md:w-56`,
      not inside `max-w-5xl`). Still `sticky top-0 h-svh`, `rail*` chrome
      unchanged.
- [ ] Destination column is uncarded (no shell `Card` border/shadow). Inner
      content `max-w-[820px]`. Destinations and `setDestination` / `onSignOut`
      handlers unchanged.
- [ ] Calendar `md+` shows an empty `aside` labelled Context (`w-80`, left
      border). No week-glance or carpool-card copy. Tests must **not** assert
      “Week at a glance” or stop-list strings.
- [ ] Context aside is absent on Carpool / Family / Places / Garage / Feeds
      and absent below `md`. Caregiver Calendar still gets the empty aside
      (Feeds omission unchanged).
- [ ] Web tests: AuthScreen/App signed-out wrapper; FamilyScreen frame
      (rail width, no shell Card, Calendar context present/absent). Existing
      sidebar destination tests still pass. `npm test` + `npm run lint` in
      `web/`.

## Tasks

- [x] Web: `App.tsx` drops `max-w-5xl`; `AuthScreen` signed-out (and
      FamilyScreen empty/loading/error Cards) keep the centered column.
- [ ] Web: circle-ready `FamilyScreen` — `md` grid, rail `md:w-60`, uncarded
      main with `max-w-[820px]`, Calendar-only Context aside (`md:w-80`).
- [ ] Tests: AuthScreen/App layout; FamilyScreen frame + destination
      presence/absence of Context; no wordmark-string or week-glance-string
      assertions. Run `npm test` + `npm run lint` in `web/`.

## Open questions

None. Mock main `max-width: 820px` inside `1fr` is locked (content left,
context docked right). Empty Context chrome vs filling it is the split with
`agenda-week-glance`.
