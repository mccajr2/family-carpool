# Spec: web-shell-page-header

Status: in-progress  
Created: 2026-08-17  
Approved: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `web-shell-page-header`  
Added: 2026-08-17 · enhancement

Scope: **web signed-in destination header only** (type, color, Calendar
copy, header↔content gap). Destinations, handlers, Add event, and the
page-frame grid stay as
[`web-shell-page-frame`](../archive/web-shell-page-frame.md). No OpenAPI,
backend, iOS, or Android.

## Problem

After page-frame uncarded the destination column, the shared page header
still looks like a shadcn `CardTitle` (`text-2xl font-semibold`, no token
color). The Calendar mock uses a larger display heading, ink/slate type, a
**Today** + weekday-date pair, and more space under the header. That was
deferred so page-frame could stay column widths only.

## Non-goals

- New type or spacing token roles for mock 34px / 36px / 44px / 26px /
  14px — map to existing `hero` (heading) and `body` (subtitle),
  `textPrimary` / `textSecondary`, and `--fc-space-xl` (header↔content gap)
- Reopening page-frame column widths, `max-w-[820px]`, main padding, or
  the Calendar Context aside
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
- iOS / Android
- Editing `design-tokens/tokens.json` or regenerating platform outputs

## Approach

Restyle the `<header>` inside circle-ready `FamilyScreen` `<main>`. Drop
`CardTitle` / `CardDescription` here — those classes (`text-2xl`,
`text-muted-foreground`) fight the token contract on an uncarded column.

**Type and color (every destination).** Heading is an `<h1>`:

| Element | Type token | Color | Font |
|---------|------------|-------|------|
| Heading | `hero` (26 / 32 / 700) — nearest to mock 34px | `textPrimary` | `fc-display` |
| Subtitle | `body` (15 / 22 / 400) — nearest to mock 14px | `textSecondary` | body (not display) |

Do **not** use `hero*` **color** roles on this chrome (`hero*` stays
Focus-card urgent spotlight). Type-scale `hero` is the existing size
role, not a new 34px entry.

Do **not** `truncate` / `whitespace-nowrap` the heading — that freezes
the `1fr` track (page-frame lock).

**Copy**

| Destination | Heading | Subtitle |
|-------------|---------|----------|
| Calendar | **Today** (not “Calendar”) | Local **today**: `weekday long`, `month long`, `day numeric`, **no year** (e.g. `Wednesday, August 13`). `toLocaleDateString(undefined, …)` like `eventTimes`. Not the first Agenda group. |
| Carpool / Places / Garage / Feeds | Unchanged names | None |
| Family | Unchanged `circleTitle(circle)` | Unchanged `displayName · email · role` (omit the name prefix when `displayName` is empty), restyled to the subtitle tokens above |

Rail labels stay as they are (Calendar still says Calendar).

**Gap.** Header↔next sibling is `--fc-space-xl` (24px; mock 26px). Isolate
that on the header — do **not** bump `main`’s `space-y-4` (that would
widen every section gap) and do **not** change `main` `px` / `py` /
`max-w-[820px]`. Calendar header stays a row: title stack left, Add right.

No contract changes.

Intake: Calendar mock HTML 2026-08-17 — `.main-header h1` 34px / 700 /
Space Grotesk / ink; `p` 14px / 500 / slate (`#686F79` = `textSecondary`);
copy **Today** + weekday date; `margin-bottom: 26px`.

## Acceptance criteria

- [ ] Calendar destination `<h1>` is **Today**. Rail control remains
      labeled Calendar. Other destinations keep today’s headings
      (Carpool, circle title, Places, Garage, Feeds).
- [ ] Calendar shows a subtitle for **local today** in
      `weekday long, month long, day numeric` form (no year). Family
      keeps the email · role subtitle (with displayName prefix when
      present). Other destinations have no header subtitle.
- [ ] Destination `<h1>` uses `--fc-font-hero-*` + `fc-display` +
      `textPrimary`. Subtitles use `--fc-font-body-*` + `textSecondary`.
      No `CardTitle` / `CardDescription`, no `text-2xl`, no `hero*`
      color variables, no new token roles.
- [ ] Header↔content gap is `--fc-space-xl` only (not stacked with
      `space-y-4`). `main` padding and `max-w-[820px]` unchanged. Add
      event control and handler unchanged.
- [ ] Web tests: Calendar Today + date subtitle (assert via the same
      locale formatter, not a hardcoded English string); other
      destination headings; Family subtitle; token classes on the
      heading; existing `heading: "Calendar"` assertions updated.
      `npm test` + `npm run lint` in `web/`.

## Tasks

- [ ] Web: circle-ready `FamilyScreen` header — token type/color, Calendar
      Today/date, Family subtitle restyle, `--fc-space-xl` under the
      header. Leave Add event and page-frame classes alone.
- [ ] Tests: FamilyScreen header copy + token classes; update Ready-state
      queries that still look for heading `Calendar`. Run `npm test` +
      `npm run lint` in `web/`.

## Open questions

None. `hero` type vs a new 34px role is locked (no new roles). Calendar
copy is **Today** + local today, not a selected Agenda day.
