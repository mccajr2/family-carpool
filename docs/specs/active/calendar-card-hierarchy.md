# Spec: calendar-card-hierarchy

Status: draft  
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

### Collapsed drive-block identity (Agenda only)

Drop the opaque count title (“Two events tonight” / “N events tonight”).
Collapsed identity is one **event band row per member**, always visible:

- Line copy: `time · (feedName if set, else title)` — so U10 then U12 reads
  as two different teams, not a fake shared eyebrow.
- Going kid(s) for that member: the same compact **`RiderChips`** used on
  `AgendaRow` (not plain-text names in the line).
- Shared day/team eyebrow only when every member actually shares a feed
  (today’s `sharedFeedName` rule). Where line stays when shared.
- Status / divergence chips and the chevron stay on the collapsed card.

**Compare — single event (`AgendaRow`, unchanged pattern):**

```
U10 Soccer
Practice
6:00–7:00 PM · Field 3
[Emma]  [status]  ⌄
```

**Compare — back-to-back kids, different teams (`AgendaBlockCard` collapsed):**

```
TODAY
6:00–7:00 PM · U10 Soccer   [Emma]
7:15–8:15 PM · U12 Soccer   [Noah]
[status]  ⌄
```

Expanded body still holds run panels, leave-from, commitment actions, and
locked chrome. Hero stays out of this — block cards are Agenda-only.

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

- [ ] `AgendaBlockCard` expands and collapses via one header chevron shared
      with the `AgendaRow` pattern; status/divergence chips stay visible
      when collapsed if plans already diverge.
- [ ] Collapsed block drops “Two events tonight” / “N events tonight”; shows
      one band row per member as `time · (feedName else title)` with
      compact `RiderChips` for that member’s going kid(s) — same chip
      component as `AgendaRow`, not text names in the line.
- [ ] Shared team eyebrow appears on the block only when all members share
      a feed; mixed teams (e.g. U10 then U12) rely on per-row feed labels.
- [ ] Block-only **Show details** / **Hide details** underline controls are
      gone; run detail lines appear in the expanded body (or an equivalent
      single chevron disclosure), not a second text-link pattern.
- [ ] Mounting `DriverPicker` on Focus, Hero, and expanded Agenda starts in
      simple mode (`data-mode="simple"`); leg-split and kid-split open only
      after activating their disclosure links.
- [ ] **Different plans for each leg** and **Different plans for each kid**
      are both present when eligible, same visual weight as each other, and
      quieter than the primary Confirm / Post button.
- [ ] When a Hero decision is picking a driver, the slide shows the simple
      round-trip picker — not the split editor — as the resting view.
- [ ] `focusAction` is bumped in `tokens.json` (starting point ~16px / 700)
      with min-height (~44) and horizontal pad (~20) spacing roles; primary
      CTAs on Focus, Hero, and DriverPicker consume those tokens (no
      one-off class sizes for those buttons).
- [ ] On light Calendar surfaces the primary is solid accent fill; secondary
      Decline / Pass stay outlined or text-only at ghost weight.
- [ ] Token/generate test asserts `focusAction.size` is greater than
      `filterChip.size` and `listRowMeta.size`; primary button computed
      min-height is at least the locked min-height token; undo /
      `RevertRideLink` font size is less than or equal to `focusAction.size`.
- [ ] No OpenAPI, backend, or non-Calendar destination restyles in this PR.
- [ ] Desktop Calendar only — no phone breakpoint restyle in this PR.

## Tasks

- [ ] Tokens: bump `focusAction` (+ companion min-height / padX spacing);
      adjust `focusActionGhost` if needed for secondary hierarchy; regenerate
      CSS; extend `design-tokens/generate.test.mjs` relative-size assertions
- [ ] Web: `AgendaBlockCard` — header chevron collapse/expand; remove Show
      details and count title; collapsed event bands + per-row compact
      `RiderChips`; shared-feed eyebrow rule unchanged
- [ ] Web: `DriverPicker` — primary button consumes bumped tokens + accent
      fill; confirm resting simple mode; disclosure links stay quieter /
      equal weight
- [ ] Web: `AgendaFocusCard` + `HeroAttentionSlide` — Confirm / Accept /
      Ask (and DriverPicker Confirm / Post) use the same primary tokens;
      Hero inverse fill preserved where required
- [ ] Tests: block chevron + no Show details/count title; collapsed bands
      show feed/title + RiderChips; mixed-feed block has no shared team
      eyebrow; DriverPicker starts simple; token hierarchy; Hero / Focus
      primary uses token classes (not hardcoded `text-sm`)
- [ ] Manual: desktop Calendar — single-event row vs U10/U12 back-to-back
      block (chip parity); gap → Confirm / Post reads larger than chips
      and undo; open Different plans → back to simple

## Open questions

- Exact ghost secondary size (14 vs 15) — pick during implement; keep below
  primary and at weight 600.
- Hero inverse primary fill stays `hero-on` (not light-theme accent) —
  locked in Approach; confirm only if dogfood finds accent on dark Hero
  clearer.
