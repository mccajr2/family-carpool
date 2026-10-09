# Spec: calendar-card-hierarchy

Status: done  

Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-08  
Added: 2026-10-08 · enhancement  
Branch: `calendar-card-hierarchy`

## Problem

Calendar already has the plans parents need, and the cards do not agree.
A single event collapses behind a chevron. A drive block stays open and
uses a separate “Show details” link. The Hero was a slim decision and now
holds the full driver editor. Confirm, Accept, and Ask use `focusAction` at
**13.5px** — the same size as `filterChip` — so the primary does not read as
primary. The simple case (one round-trip for every going kid) is not what
the card leads with when split chrome is equally loud.

## Non-goals

- New ride states, week-exception, mail, or session work
- Removing per-kid or per-leg plans (they stay one step inside)
- Phone breakpoints / phone-width Calendar (`calendar-phone-frame`)
- Restyling Carpool, Family, Places, Feeds, or the Route screen
- New OpenAPI fields or backend/domain changes
- Filling undo holes (`action-undo-parity`) — existing reverses stay
  reachable as the quieter control; missing reverses are out of scope
- Changing coverage priority / Hero queue membership

## Approach

**Web Calendar only.** No contract or backend changes.

### One chevron

`AgendaRow` already expands/collapses via a header chevron
(`data-testid="agenda-row-chevron"`). `AgendaBlockCard` today keeps the
body open and uses a per-run underlined **Show details** /
**Hide details** toggle. Align the block card to the same pattern: one
header chevron, collapsed summary visible, expanded body for runs,
leave-from, commitment actions, and locked chrome. Remove the block-only
“Show details” underline as a second disclosure pattern. Reuse the same
chevron icon sizing token (`listRowChevron`).

### Combined-event identity (Agenda only)

A combined card uses the same header structure as a single event. The title
consumes `listRowTitle` (the single-card title role — same size and weight).
Do not invent a larger title size for the pair.

- Eyebrow: feed names in member order, joined with ` + ` when teams differ
  (`Mite 3 + Squirt 1`). One shared feed stays a single eyebrow. No feeds →
  no eyebrow.
- Title: the shared event name. Identical titles stay as-is. Titles that
  share a leading and trailing word (`CYH Mite 3 Practice` +
  `CYH Squirt 1 Practice`) collapse to those shared words (`CYH Practice`).
  Unrelated titles join with ` + `.
- When: the block span, same compact format as a single card
  (`Oct 13, 6:00 – 7:50 PM`).
- One header chip when every leg is assigned: `You · round trip` when one
  person drives every leg, otherwise `You · N of M legs`. If any leg still
  needs a ride or is asked of the team, keep the urgent status chips instead.
- Chevron is its own button, 44px hit target (`focusActionMinHeight`),
  labeled Expand / Collapse.

Collapsed body is one kid row per going kid on each member: avatar, name,
that kid’s event and clock, and `There {driver} · Back {driver}` on the right.

Expanded body replaces those rows with the same Getting there / Coming back
pair used on a single card, then one shared control row: Edit plan, per-kid
not going, Split into N events, and Remove recurring coverage (danger). Drop
the old run panels and the separate “not your job” band — the other driver
is the Back (or There) name. View route stays on the routable leg box.
Leave-from and commitment actions stay available when the plan is not in the
settled locked view.

**Compare — single event (`AgendaRow`):**

```
U10 SOCCER
Practice                          [status]  ⌄
Oct 13, 6:00 – 7:00 PM
Field 3
[Emma]
```

**Compare — combined, different teams (`AgendaBlockCard` collapsed):**

```
MITE 3 + SQUIRT 1
CYH Practice                      You · 3 of 4 legs  ⌄
Oct 13, 6:00 – 7:50 PM
155 Gore St
[K] Kian          Mite 3 · 6:00 – 6:50 PM     There You · Back Katy
[D] Declan        Squirt 1 · 7:00 – 7:50 PM   There You · Back You
```

Hero stays out of this — block cards are Agenda-only.

### Recurring plans stay collapsed until expand

`Plan locked` (title, Edit / not going / Remove, and the scope caption) is
inside the expanded body on both single rows and combined cards. A collapsed
recurring row shows only `↻ Every {weekday}` beside the kid, plus the status
chip, so it stays the same height as a ride-needed card. Expanding a locked
single row shows the There / Back pair, then Plan locked. The scope caption
stays in that expanded section.

### Simple plan first

`DriverPicker` already defaults to `mode === "simple"` (shared round-trip
for every going kid). Keep that as the resting editor on Focus / Hero and
expanded Agenda rows. **Different plans for each leg** and **Different
plans for each kid** stay progressive disclosure one step inside — same
weight as each other, quieter than the primary button. Opening a card or
Hero slide must not land in `legSplit` / `kidSplit`. When plans already
diverge, the collapsed summary still shows that via existing chips (no
forced open into split).

Hero stays one decision surface. When that decision is picking a driver,
mount the simple round-trip `DriverPicker` (not the split editor).

### Primary action token (bump in place)

`focusAction` (13.5 / 700) is used only on Calendar decision CTAs today:

- `DriverPicker` Confirm / Post / Save ride plan
- `AgendaFocusCard` Confirm coverage / Accept / Request

Hero carousel Confirm / Accept still use hardcoded `text-sm` and do **not**
consume `focusAction` — wire them to the same token in this slice.

Because usage is Calendar-primary-only, **bump `focusAction` in place**
(do not add a parallel `primaryAction` typography role). Add companion
spacing roles for touch target and horizontal padding. Proposed starting
values (tune in review; AC is relative, not brittle px locks):

| Role | Starting values |
| ---- | ---------------- |
| `typography.scale.focusAction` | size **16**, lineHeight **22**, weight **700** |
| Spacing `focusActionMinHeight` | **44** |
| Spacing `focusActionPadX` | **20** |
| Fill | solid **accent** on light Calendar surfaces; Hero inverse keeps existing on-inverse primary fill but uses the same size / weight / min-height / pad tokens |

Secondary decision controls (Decline, Pass, ghost siblings) stay on
`focusActionGhost` — outlined or text-only; bump ghost to about **14–15 /
600** if needed so secondary is quieter than the solid primary but still
readable. Undo / `RevertRideLink` stay at current size or smaller so they
read as the quiet reverse.

Lock values in `design-tokens/tokens.json` and regenerate CSS. Assert in
tests that the primary token is larger than `filterChip`, `listRowMeta`,
and the undo link size — not a pixel-for-pixel UI snapshot of every button.

## Context

Allowlist for `/implement`.

- Design: `docs/ui-system.md` (token lock / WCAG AA exception only);
  `design-tokens/tokens.json` → `typography.scale.focusAction`,
  `focusActionGhost`, `filterChip`, `listRowMeta`, `listRowChevron`;
  spacing companions for primary min-height / padX
- Source: `web/src/components/AgendaRow.tsx` (chevron + compact `RiderChips`);
  `web/src/components/AgendaBlockCard.tsx` (`RunSection` Show details,
  `blockTitle`, event bands);
  `web/src/components/agendaBlockSections.ts` (event band lines);
  `web/src/components/RiderChipsView.tsx` (compact rider chips);
  `web/src/components/DriverPicker.tsx` (simple / legSplit / kidSplit,
  `renderPrimaryButton`);
  `web/src/components/AgendaFocusCard.tsx` (Confirm / Accept / Request);
  `web/src/components/HeroAttentionSlide.tsx` (hardcoded Confirm / Accept);
  `web/src/components/coverageCopy.ts` (disclosure + back-to-simple copy);
  `web/src/components/RevertRideLink.tsx` (quiet reverse baseline)
- Tests: colocated `AgendaBlockCard.test.tsx`, `DriverPicker.test.tsx`,
  `AgendaFocusCard.test.tsx`, `HeroAttentionCarousel.test.tsx` /
  slide tests; `design-tokens/generate.test.mjs` for token assertions

## Acceptance criteria

- [x] `AgendaBlockCard` expands and collapses via one header chevron shared
      with the `AgendaRow` pattern; status/divergence chips stay visible
      when collapsed if plans already diverge.
- [x] Collapsed block drops “Two events tonight” / “N events tonight”. Header
      matches a single card: feed eyebrow, `listRowTitle` title, compact when
      line, and one plan chip (`You · round trip` or `You · N of M legs`)
      when every leg is assigned. Urgent status chips stay when a leg is open.
- [x] Collapsed body is one kid row per going kid: avatar, name, that kid’s
      event and clock, and `There {driver} · Back {driver}`. Mixed feeds read
      in the eyebrow (`U10 Soccer + U12 Soccer`) and on the kid row.
- [x] Expanded body shows each kid’s Getting there / Coming back pair, then
      shared controls (Edit plan, not going, Split into N events, Remove).
      Run panels and the separate not-your-job band are gone. View route
      stays on the routable leg.
- [x] Plan locked chrome is hidden until the card is expanded, on single rows
      and combined cards. Collapsed recurring rows show `↻ Every {weekday}`
      beside the kid. The scope caption stays in the expanded section.
- [x] Block-only **Show details** / **Hide details** underline controls are
      gone; run detail lines appear in the expanded body (or an equivalent
      single chevron disclosure), not a second text-link pattern.
- [x] Mounting `DriverPicker` on Focus, Hero, and expanded Agenda starts in
      simple mode (`data-mode="simple"`); leg-split and kid-split open only
      after activating their disclosure links.
- [x] **Different plans for each leg** and **Different plans for each kid**
      are both present when eligible, same visual weight as each other, and
      quieter than the primary Confirm / Post button.
- [x] When a Hero decision is picking a driver, the slide shows the simple
      round-trip picker — not the split editor — as the resting view.
- [x] `focusAction` is bumped in `tokens.json` (starting point ~16px / 700)
      with min-height (~44) and horizontal pad (~20) spacing roles; primary
      CTAs on Focus, Hero, and DriverPicker consume those tokens (no
      one-off class sizes for those buttons).
- [x] On light Calendar surfaces the primary is solid accent fill; secondary
      Decline / Pass stay outlined or text-only at ghost weight.
- [x] Token/generate test asserts `focusAction.size` is greater than
      `filterChip.size` and `listRowMeta.size`; primary button computed
      min-height is at least the locked min-height token; undo /
      `RevertRideLink` font size is less than or equal to `focusAction.size`.
- [x] No OpenAPI, backend, or non-Calendar destination restyles in this PR.
- [x] Desktop Calendar only — no phone breakpoint restyle in this PR.

## Tasks

- [x] Tokens: bump `focusAction` (+ companion min-height / padX spacing);
      adjust `focusActionGhost` if needed for secondary hierarchy; regenerate
      CSS; extend `design-tokens/generate.test.mjs` relative-size assertions
- [x] Web: `AgendaBlockCard` — header chevron collapse/expand; remove Show
      details and count title; collapsed event bands + per-row compact
      `RiderChips`; shared-feed eyebrow rule unchanged
- [x] Web: `DriverPicker` — primary button consumes bumped tokens + accent
      fill; confirm resting simple mode; disclosure links stay quieter /
      equal weight
- [x] Web: `AgendaFocusCard` + `HeroAttentionSlide` — Confirm / Accept /
      Ask (and DriverPicker Confirm / Post) use the same primary tokens;
      Hero inverse fill preserved where required
- [x] Tests: block chevron + no Show details/count title; combined header
      uses the single-card title role; collapsed kid rows show There/Back;
      mixed feeds join on the eyebrow; Plan locked is expanded-only;
      DriverPicker starts simple; token hierarchy; Hero / Focus primary uses
      token classes (not hardcoded `text-sm`)
- [x] Manual: desktop Calendar — single-event row vs U10/U12 back-to-back
      block (chip parity); gap → Confirm / Post reads larger than chips
      and undo; open Different plans → back to simple

## Open questions

- Exact ghost secondary size (14 vs 15) — pick during implement; keep below
  primary and at weight 600.
- Hero inverse primary fill stays `hero-on` (not light-theme accent) —
  locked in Approach; confirm only if dogfood finds accent on dark Hero
  clearer.
