# Spec: web-shell-page-header

Status: done  
Created: 2026-08-17  
Updated: 2026-08-17 (`/pr`)  
Approved: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `web-shell-page-header`  
Added: 2026-08-17 · enhancement

Scope: **web signed-in destination header** (type, color, Calendar copy,
header↔content gap) **and** Calendar-mock padding on destination `<main>`
and the nav rail. Destinations, handlers, Add event, and the page-frame
**grid** stay as
[`web-shell-page-frame`](../archive/web-shell-page-frame.md). No OpenAPI,
backend, iOS, or Android.

## Problem

After page-frame uncarded the destination column, the shared page header
still looked like a shadcn `CardTitle`. The Calendar mock is the visual
source of truth: 34px / 700 display heading, 14px / 500 slate subtitle,
**Today** + weekday date, 26px under the header. Snapping those to nearby
existing roles (`hero` 26, `body` 15/400, `space-xl` 24) was a premature
lock — tokens absorb mock values instead ([`docs/ui-system.md`](../../ui-system.md)).

## Non-goals

- Reopening page-frame column widths, `max-w-[820px]`, or the Calendar
  Context aside
- Restyling the Add event button (same `Button` `size="sm"`, same
  `aria-label`, same compose handler)
- Focus card, filter/status chips, section labels, week-glance, carpool
  stop card ([`agenda-focus-card-polish`](../planned/agenda-focus-card-polish.md),
  [`agenda-list-chips`](../planned/agenda-list-chips.md),
  [`agenda-week-glance`](../planned/agenda-week-glance.md),
  [`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Changing destination set, order, or click handlers
- Date navigation / jumping the Agenda to a picked day (subtitle is
  **today**, not the scrolled group)
- iOS / Android (generated token outputs update; UI ports stay parked)
- Changing `hero` type-scale (Focus card still owns that until polish) or
  `hero*` **color** roles

## Approach

Restyle the `<header>` inside circle-ready `FamilyScreen` `<main>`. Drop
`CardTitle` / `CardDescription` here.

**Tokens — absorb the mock, do not snap.** Add roles and regenerate
(`node design-tokens/generate.mjs`):

| Role | Value | Mock |
|------|-------|------|
| `typography.scale.page` | 34 / 40 / 700 | `.main-header h1` 34px / 700 |
| `typography.scale.subtitle` | 14 / 20 / 500 | `.main-header p` 14px / 500 |
| `spacing.header` | 26 | header `margin-bottom: 26px` |
| `spacing.mainY` | 36 | `.main` padding-top/bottom |
| `spacing.mainX` | 44 | `.main` padding-left/right |
| `spacing.railY` | 28 | `.sidebar` padding-top/bottom |
| `spacing.railX` | 20 | `.sidebar` padding-left/right |

Line-heights 40 / 20 are not in the mock notes; they pair with those sizes.
Colors stay existing `textPrimary` / `textSecondary` (`#686F79` slate =
`textSecondary`, already AA-adjusted).

**Type and color (every destination).** Heading is an `<h1>`:

| Element | Type token | Color | Font |
|---------|------------|-------|------|
| Heading | `page` (34 / 40 / 700) | `textPrimary` | `fc-display` |
| Subtitle | `subtitle` (14 / 20 / 500) | `textSecondary` | body (not display) |

Do **not** use `hero*` **color** roles. Do **not** `truncate` /
`whitespace-nowrap` the heading (page-frame lock).

**Copy**

| Destination | Heading | Subtitle |
|-------------|---------|----------|
| Calendar | **Today** (not “Calendar”) | Local **today**: `weekday long`, `month long`, `day numeric`, **no year** (e.g. `Wednesday, August 13`). `toLocaleDateString(undefined, …)` like `eventTimes`. Not the first Agenda group. |
| Carpool / Places / Garage / Feeds | Unchanged names | None |
| Family | Unchanged `circleTitle(circle)` | Unchanged `displayName · email · role` (omit the name prefix when `displayName` is empty), restyled to the subtitle tokens above |

Rail labels stay as they are (Calendar still says Calendar).

**Gap.** Header↔next sibling is `--fc-space-header` (26px). Isolate that
on the header — do **not** bump `main`’s `space-y-4`. Calendar header stays
a row: title stack left, Add right.

**Main padding.** `.main` uses `padding: 36px 44px` — `--fc-space-mainY`
vertical, `--fc-space-mainX` horizontal. No `md:` bump (the mock has none).
`max-w-[820px]` unchanged.

**Rail padding.** `.sidebar` uses `padding: 28px 20px` — `--fc-space-railY`
vertical, `--fc-space-railX` horizontal (not `space-md` 12). Wordmark has no
extra inset beyond that.

No contract changes.

Intake: Calendar mock HTML 2026-08-17 — `.main-header h1` 34px / 700 /
Space Grotesk / ink; `p` 14px / 500 / slate; copy **Today** + weekday date;
`margin-bottom: 26px`; `.main` `padding: 36px 44px`; `.sidebar`
`padding: 28px 20px`.

## Acceptance criteria

- [x] Calendar destination `<h1>` is **Today**. Rail control remains
      labeled Calendar. Other destinations keep today’s headings
      (Carpool, circle title, Places, Garage, Feeds).
- [x] Calendar shows a subtitle for **local today** in
      `weekday long, month long, day numeric` form (no year). Family
      keeps the email · role subtitle (with displayName prefix when
      present). Other destinations have no header subtitle.
- [x] Destination `<h1>` uses `--fc-font-page-*` + `fc-display` +
      `textPrimary` (34 / 700). Subtitles use `--fc-font-subtitle-*` +
      `textSecondary` (14 / 500). No `CardTitle` / `CardDescription`, no
      `text-2xl`, no `hero*` color variables. `tokens.json` has `page`,
      `subtitle`, `spacing.header` (26), `mainY` (36), `mainX` (44),
      `railY` (28), `railX` (20); generated outputs regenerated.
- [x] Header↔content gap is `--fc-space-header` (26px) only (not stacked
      with `space-y-4`). Destination `<main>` padding is `--fc-space-mainY`
      / `--fc-space-mainX` (36 / 44), not `space-xl` / `2xl`, no `md:px`
      bump. `max-w-[820px]` unchanged. Nav rail padding is `--fc-space-railY`
      / `--fc-space-railX` (28 / 20), not `space-md`. Add event control and
      handler unchanged.
- [x] Web tests: Calendar Today + date subtitle (assert via the same
      locale formatter); token classes `page` / `subtitle` / `header` /
      `mainX` / `mainY` / `railX` / `railY` (not `hero` / `space-xl` /
      `md:px` / `space-md` on the rail for this chrome);
      existing `heading: "Calendar"` assertions updated. `npm test` +
      `npm run lint` in `web/`. Token generate `--check` + `ui-system-doc`
      test.

## Tasks

- [x] Web: circle-ready `FamilyScreen` header copy — Calendar Today/date,
      Family subtitle, drop `CardTitle`. (Type/gap tokens follow.)
- [x] Tokens: add `page`, `subtitle`, `spacing.header`; regenerate
      platform outputs; apply on the destination header (not `hero` /
      `space-xl`).
- [x] Tokens + web: `.main` padding `mainY` 36 / `mainX` 44 (mock
      `36px 44px`); drop `md:px` snap. Regenerate outputs.
- [x] Tests: FamilyScreen header copy; update Ready-state queries that
      still look for heading `Calendar`.
- [x] Tokens + web: rail padding `railY` 28 / `railX` 20 (mock
      `28px 20px`); drop wordmark extra inset.
- [x] Tests: main padding token classes. Run `npm test` + `npm run lint`
      in `web/` and `node --test design-tokens/*.test.mjs`.

## Open questions

None. Main padding `36px 44px`; rail padding `28px 20px`.
