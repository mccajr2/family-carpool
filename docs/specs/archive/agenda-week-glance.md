# Spec: agenda-week-glance

Status: archived  
Completed: 2026-08-18  
Created: 2026-08-17
Parent: [docs/roadmap.md](../../roadmap.md)
Branch: `agenda-week-glance`
Added: 2026-08-17 · enhancement

Scope: **web Calendar Context aside only** — fill the empty right column with
a coverage/status strip derived from the already-loaded Agenda.
**Amendment (2026-08-28):** strip expanded from five to **seven** local days
to match the hero carousel / **This week** horizon — see
[`agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md).
No OpenAPI, backend, iOS, or Android. Same calendar GET / kid filter /
handlers — presentation + a client rollup.

## Problem

Adults scanning the week have no compact “is this day OK?” strip. Focus is
exactly one next action
([`agenda-focus-next-action`](../archive/agenda-focus-next-action.md));
rest-of-week gaps stay in the list and were supposed to surface here.
[`web-shell-page-frame`](../archive/web-shell-page-frame.md) already reserved
the Calendar Context aside (`w-80`, left border) and left it empty.

The Calendar light mock (2026-08-17 HTML) puts **Week at a glance** in that
column: five weekday rows with coverage/driver status and an amber flag on
days that need attention. That is not the month/week **grid**
([`family-calendar-grid`](../planned/family-calendar-grid.md)).

## Non-goals

- Month/week calendar grid, date picking, or jumping the Agenda to a day
  ([`family-calendar-grid`](../planned/family-calendar-grid.md);
  [`web-shell-page-header`](../archive/web-shell-page-header.md) already
  deferred date navigation)
- The mock’s **Sharks Practice — Carpool** numbered-stop card + Open in Maps
  ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- **“N need drivers” / “Needs driver”** copy — `CalendarItem` has no ride /
  driver field and [`carpool-request-accept`](../archive/carpool-request-accept.md)
  is not shipped. Do not invent stop counts or treat uncovered as “needs a
  driver.” Driver/ride rollups wait for that slice (and
  [`agenda-focus-carpool-actions`](../archive/agenda-focus-carpool-actions.md))
- New backend endpoints or OpenAPI fields — the loaded Agenda window powers
  the strip
- Changing Focus ranking, coverage / RSVP / leave-by **write** rules, or
  kid-filter semantics
- Changing page-frame grid (`15rem 1fr 20rem`), Context `w-80`, or showing
  Context on non-Calendar destinations
- A stacked/collapsible breakpoint for the aside (page-frame already paints
  Context at all widths; product non-goal: desktop-first UX)
- iOS / Android ([`agenda-week-glance-mobile`](../planned/agenda-week-glance-mobile.md))
- Using `hero*` **color** roles (Focus-card urgent spotlight only)

## Approach

**No contract change.**

**Visual source:** Calendar light mock HTML 2026-08-17, **right rail only**
(`.rail` + `.week-item` / `.week-day` / `.week-count` / `.week-flag`). Ignore
`.carpool-card`. Measure size, weight, spacing, and color from that region;
add or update roles in `design-tokens/tokens.json` in the same PR
(`docs/ui-system.md`). Do **not** snap week-day type, flag size, or aside
padding to nearby Focus / Feeds / `space-*` roles. WCAG AA is the only
mock-hex exception.

Mock fixture copy (Wed–Sun) is illustrative. Lock the product rules below;
do not reverse-engineer the Hang-with-Arthur list into those five strings.

### Chrome (fill the existing aside)

Keep `aria-label="Context"` on the Calendar `<aside>`. Replace
`p-[var(--fc-space-xl)]` with mock padding tokens. Render an
`AgendaWeekGlance` component (web: one component per file) inside it.
Heading is mock **Week at a glance** (Title Case `h3`, display font) — not
`WEEK AT A GLANCE`. Rows are **not** buttons or links (Hick: no extra
choices; jump-to-day stays the grid).

### Five-day window

Always **today + the next four local days** (five rows, never omit a day).
Reuse `startOfLocalDay` / `addDays` from `agendaDayGroups.ts` so Focus, day
groups, and this strip cannot drift. Inject `now` (default `new Date()`)
for tests.

This is a **subset** of the seven-day “This week” bucket (`weekEnd` =
today+7). Days today+5 and today+6 can still appear under **This week** in
the list; they are not in the strip.

Bucket an item onto the local calendar day of `startsAt` (same as grouping).
Unparseable `startsAt` is skipped (no throw). Overnight events count on the
start day only.

### Data

Derive from **`visibleCalendarItems`** (kid-filtered loaded window) — the
same list as Focus + rows, **including** the Focus item (not `restItems`).
Do not fetch a wider range. The initial calendar load is today → +30d, so
all five days are already in window.

### Per-day status (one line)

Count **in-play events**, not kids. Out-of-play (`isAgendaItemOutOfPlay`)
never increment uncovered / overlap / confirm counts. A day whose only
items are out-of-play is **All set**, not **No events**.

Pass `currentAdultId` (same as Focus) so pending-for-self matches
`pendingCoverageForAdult`.

First match:

| Condition | Copy | Flag |
|-----------|------|------|
| Zero items that local day | **No events** | none |
| `n` in-play with `uncoveredKidIds.length > 0` | **1 needs coverage** / **{n} need coverage** | amber |
| else `n` in-play with `conflicts.length > 0` | **1 overlaps** / **{n} overlap** | amber |
| else `n` in-play pending-for-self | **1 to confirm** / **{n} to confirm** | amber |
| else (in-play all-set, pending-for-others, out-of-play only) | **All set** | none |

Do **not** emit **need drivers**. Pending-for-others without uncovered /
conflict is calm (**All set**), matching Focus `focusItemNeedsDecision`.

### Tokens (absorb the mock)

From `.rail` / `.week-*` (line-heights not in the HTML; pair with the size):

| Role | Value | Mock |
|------|-------|------|
| `typography.scale.weekGlanceTitle` | 16 / 20 / 700 | `.rail h3` 16px / 700 display |
| `typography.scale.weekDay` | 12 / 16 / 700 | `.week-day` 12px / 700 uppercase |
| `typography.scale.weekCount` | 13 / 18 / 600 | `.week-count` 13px / 600 |
| `typography.scale.weekCountCalm` | 13 / 18 / 500 | `.week-count.zero` 13px / 500 |
| `spacing.weekGlancePadX` | 28 | `.rail` padding-left/right |
| `spacing.weekItemPadY` | 10 | `.week-item` padding 10px 0 |
| `spacing.weekDayWidth` | 38 | `.week-day` width 38px |
| `spacing.weekFlag` | 7 | `.week-flag` 7×7 |

Reuse where the mock value is **exact**, not nearby: vertical aside padding
**`mainY` (36)** (same 36 as `.main`); heading→list gap **`space-lg` (16)**;
row hairline **`border`**. Do **not** reuse `feedSectionLabel` (12/700) or
`focusStatusDot` (6) — different surfaces.

**Color:** attention copy `textPrimary`; weekday + calm copy `textSecondary`
(mock `--slate-light` `#9CA1A8` on paper fails WCAG AA — use the existing
AA slate). Flag `danger` (mock amber `#A9590C` is already light `danger`).
No `hero*` colors. No raw px/hex in the component.

Regenerate (`node design-tokens/generate.mjs` + `--check`). Light and dark
both consume generated vars.

Record the five-day copy in
[`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
so the mobile port cannot drift.

## Context

Allowlist for `/implement` — do not load the rest of `docs/`.

- Design: [`docs/ui-system.md`](../../ui-system.md) (mocks → tokens; WCAG AA
  hex exception; no `hero*` on this strip)
- Architecture: [`docs/architecture.md`](../../architecture.md) →
  **Interaction UX** (Hick: few choices; Calendar is the living reference)
- Agenda copy / out-of-play:
  [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
- Focus vs rest-of-week:
  [`docs/agenda-focus-card-addendum.md`](../../agenda-focus-card-addendum.md)
  (ranking already shipped; this slice is the per-day rollup)
- Frame chrome (do not reopen widths):
  [`docs/specs/archive/web-shell-page-frame.md`](../archive/web-shell-page-frame.md)
- Source: `web/src/components/FamilyScreen.tsx` (Calendar `<aside
  aria-label="Context">`, `visibleCalendarItems`, `adult?.id`),
  `agendaDayGroups.ts` (`startOfLocalDay`, `addDays`),
  `coverageDisplay.ts` (`pendingCoverageForAdult`),
  `rsvpDisplay.ts` (`isAgendaItemOutOfPlay`),
  `design-tokens/tokens.json`
- Tests: `FamilyScreen.test.tsx` (empty-Context assertion around
  “Calendar-only Context aside”), `agendaDayGroups.test.ts` (clock-freeze
  pattern)

Do not load `docs/roadmap.md` or the whole architecture file. Do not restyle
Focus, list chips, or Feeds.

## Acceptance criteria

- [x] Calendar Context aside is no longer empty: heading **Week at a glance**
      and **exactly five** weekday rows. Other destinations still have no
      Context. No carpool card, **Open in Maps**, or **need drivers** copy.
- [x] Frozen `now`: the five labels are today … today+4 local weekdays
      (uppercase three-letter, e.g. `Wed`), using `agendaDayGroups` day math.
      Days today+5 / today+6 are not rows.
- [x] Frozen `now`: one in-play uncovered event today → **1 needs coverage**
      + flag; two such events → **2 need coverage** + flag. Two uncovered
      kids on **one** event still **1 needs coverage**.
- [x] Frozen `now`: all-set today + uncovered Friday (within the five days)
      → today **All set** (no flag), Friday **needs coverage** + flag. Focus
      ranking is unchanged (tonight still wins).
- [x] All-RSVP-No items do not count as uncovered; a day with only those
      items is **All set**. A day with zero items is **No events**.
- [x] In-play conflict (no uncovered) → **1 overlaps** / **{n} overlap** +
      flag. Pending coverage for the signed-in adult (no uncovered/conflict)
      → **1 to confirm** / **{n} to confirm** + flag. Pending for someone
      else is **All set**.
- [x] Kid filter uses `visibleCalendarItems`: filtering to one kid drops
      other kids’ events from the rollup (a day can become **No events**).
- [x] Rows are not buttons/links and do not scroll or filter the Agenda.
      Grid, Context `w-80`, and aside presence rules stay as page-frame.
- [x] Mock-measured type/spacing locked in `tokens.json` and consumed via
      `--fc-*` (no raw px/hex; no `hero*` color vars). Calm weekday/status
      text uses AA `textSecondary`, not mock slate-light.
- [x] `cd web && npm test`, `npm run lint`, and
      `node design-tokens/generate.mjs --check` pass.

## Tasks

- [x] **Tokens:** add `weekGlance*` / `weekDay` / `weekCount*` roles from the
      table above; regenerate platform outputs; WCAG AA on new text pairings
      (`contrast.test.mjs` as needed).
- [x] **Web:** `agendaWeekGlanceDays.ts` helper (`days` + status from items,
      `now`, `currentAdultId`) + `AgendaWeekGlance.tsx`; mount in Calendar
      Context; pass `visibleCalendarItems` and `adult?.id`.
      (Helper file is `agendaWeekGlanceDays.ts`, not `agendaWeekGlance.ts` —
      case-insensitive import would collide with the component.)
- [x] **Docs:** add a Week-at-a-glance section to
      `docs/agenda-coverage-web-contract.md` (five-day window, copy table,
      event-not-kid counts, no driver line).
- [x] **Tests:** helper cases for the AC table (inject `now` + adult id);
      component renders five rows / heading / flag / no Maps; update
      `FamilyScreen.test.tsx` empty-aside assertion (heading present on
      Calendar, still absent elsewhere; still no Open in Maps). Run
      `npm test` + `npm run lint` in `web/` plus token `--check`.

## Open questions

None — mock HTML 2026-08-17 `.rail` week strip is the visual source; driver
copy is deferred until a per-event ride field exists; jump-to-day stays the
grid. If mock px conflict with an older token lock, defer to the mock per
`docs/ui-system.md` (AA hex exception already applied to slate-light).
