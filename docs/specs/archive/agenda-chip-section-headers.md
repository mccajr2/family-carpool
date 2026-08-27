# Spec: agenda-chip-section-headers

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Updated: 2026-08-26 (`/pr`)  
Added: 2026-08-26 · enhancement  
Branch: `agenda-chip-section-headers`

## Problem

Agenda status chips still use Title Case **pills** with a leading bullet/dot
(`AgendaStatusChip` `appearance="pill"` on Focus + collapsed rows), shipped in
[`agenda-list-chips`](../archive/agenda-list-chips.md) and Focus polish. Feeds
already established the governing chip language: **uppercase**, **no bullet**,
`feedChip*` size/weight/padding (`CarpoolFeedStatusChip`). Agenda should match
so Calendar reads as one product surface.

Agenda list **section headers** still use sentence-case Title labels (`Today`,
`Tomorrow`, `This week`, `Later`) with primary body styling. The Calendar mock
and roadmap lock call for all-caps slate section chrome —
**NEEDS YOUR ATTENTION** / **REST OF TODAY** / **TOMORROW** / **THIS WEEK** /
**LATER** — aligned with Feeds section labels (`feedSectionLabel*` tokens).

Design docs still describe Title Case pills; later slices must not reintroduce
them.

## Non-goals

- Focus selection / ranking rules or carpool ride CTAs (Accept/Pass/Request/
  Cancel/Withdraw)
- Ride who/where/kids/seats density —
  [`agenda-carpool-state-clarity`](../active/agenda-carpool-state-clarity.md)
- Rider initials circles —
  [`agenda-ride-rider-chips`](../planned/agenda-ride-rider-chips.md)
- Kid-filter chip restyle (already mock-aligned via `AgendaKidFilterChip`)
- Feeds page changes beyond reusing its chip + section-label tokens
- OpenAPI / backend changes
- Expo / KMP Agenda ports
- Adding Accept/Pass to collapsed Agenda rows

## Approach

**Web-only presentation** over existing handlers and `agendaItemStatusTags`
precedence. No contract bump.

### 1. Status chips → Feeds language

- **Focus + collapsed `AgendaRow`:** stop passing `appearance="pill"`. Use the
  Feeds-aligned chip path (default `appearance="tag"` or explicit feeds layout).
- **`AgendaStatusChip`:** align **tag** mode to `feedChip*` tokens
  (`--fc-space-feed-chip-pad-*`, `--fc-font-feed-chip-*`) and uppercase via
  CSS (same as `CarpoolFeedStatusChip`). Keep tone fills (`mint` / `amber` /
  `route` / `muted`) and **hero** variant tints for Focus urgent surface — only
  geometry/typography match Feeds, not hero spotlight colors.
- **Retire pill on Agenda surfaces:** remove `appearance="pill"` from Focus and
  rows. Out-of-play **Not going** may stay muted tag (uppercase). Do not render
  the leading `agenda-status-pill-dot`.
- **Label strings:** keep canonical Title Case in `agendaItemStatusTags` /
  `carpoolDisplay` (e.g. `"Needs coverage"`) — uppercase is a presentation
  concern in the chip component, same as Feeds status labels.
- **Tokens:** prefer reusing existing `feedChip*` roles. Add roles only if Focus
  hero chips need distinct padding — measure from mock; do not snap to
  `statusChip*` or `focusStatusPill*` if they diverge from Feeds.

### 2. List section headers

Replace `groupAgendaByDay` + floating Focus-above-list chrome in
`FamilyScreen` with sectioned Agenda layout.

**NEEDS YOUR ATTENTION** means “you have something to do on Calendar.” A
decision-needed Focus card **belongs under that header** — by definition
Accept / Pass / Confirm / Assign / conflict on Focus needs your attention.
Focus stays the **hero visual** (one card, same ranking); it is no longer
orphaned above the sections when it needs a decision.

**Section membership:**

| Section label | Contents |
| --- | --- |
| **NEEDS YOUR ATTENTION** | (1) Focus card **when** `focusItemNeedsDecision` is true (family decision **or** eligible ride Accept/Pass); then (2) other local-**today**, in-play list rows where `agendaItemNeedsAttention` is true (coverage gap / conflict / Confirm-for-you). Focus is never also rendered as a list row. |
| **REST OF TODAY** | Remaining local **today** list rows only (including out-of-play). **Does not** host Focus. |
| **TOMORROW** | Local tomorrow bucket (unchanged boundary math) |
| **THIS WEEK** | Days today+2 … today+6 (same as current `this-week`) |
| **LATER** | Beyond week window or unparseable `startsAt` |

Why two predicates:

- **Focus** uses `focusItemNeedsDecision` — includes eligible **Accept/Pass**,
  because that CTA lives only on Focus.
- **List rows** use `agendaItemNeedsAttention` (family/coverage only) — rows
  still do **not** get Accept/Pass. A non-Focus eligible ask stays in
  **REST OF TODAY** (or later), not teased as attention without a row CTA.

Layout rules:

- When Focus needs a decision: render **NEEDS YOUR ATTENTION** header → Focus
  hero → other attention rows (if any) under the same section.
- When Focus is calm (`focusItemNeedsDecision` false): Focus **floats above
  all sections** with no section header (page date + card already imply
  “next today”). Do not place calm Focus under **REST OF TODAY**.
- **Omit empty sections** entirely (no header with zero content) — including
  no **NEEDS YOUR ATTENTION** when Focus is calm and no other attention rows.
- **Tomorrow date sublabel** (e.g. `Aug 16`): keep optional secondary line if
  mock/Feeds pattern uses it; section primary label is **TOMORROW** (all caps).
- **Header styling:** reuse Feeds section label tokens
  (`feedSectionLabel*` / `FeedCard` section label class) — uppercase slate
  secondary text, not `text-sm font-semibold` primary.

### 3. Docs lock

Amend chip + section guidance so archived pill language is explicitly superseded:

- `docs/agenda-coverage-web-contract.md` → collapsed status tags
- `docs/agenda-focus-card-addendum.md` → status pills section
- `docs/agenda-full-redesign-addendum.md` → collapsed row summary
- `docs/ui-system.md` → chip guidance if Agenda chip roles are consolidated

## Context

Allowlist for `/implement`.

- Archived (superseded pill decision): [`docs/specs/archive/agenda-list-chips.md`](../archive/agenda-list-chips.md)
- Archived (Feeds chip reference): [`docs/specs/archive/feeds-page-redesign.md`](../archive/feeds-page-redesign.md)
- Design: `docs/ui-system.md` → Typography / Spacing (`feedChip*`, section labels)
- Contract: `docs/agenda-coverage-web-contract.md` → Coverage → Display (collapsed status tags)
- Contract: `docs/agenda-focus-card-addendum.md` → Slim summary (status pills)
- Contract: `docs/agenda-full-redesign-addendum.md` → New rules (collapsed summary)
- Web: `web/src/components/agendaStatusChip.tsx`
- Web: `web/src/components/AgendaFocusCard.tsx`, `AgendaRow.tsx`
- Web: `web/src/components/CarpoolFeedActions.tsx` (`CarpoolFeedStatusChip` reference)
- Web: `web/src/components/FeedCard.tsx` (section label class)
- Web: `web/src/components/agendaDayGroups.ts` (bucket boundaries — extend, do not break week glance / Focus)
- Web: `web/src/components/coverageDisplay.ts` (`agendaItemNeedsAttention`)
- Web: `web/src/components/agendaFocusSelection.ts` (`focusItemNeedsDecision`)
- Web: `web/src/components/FamilyScreen.tsx` (Focus + list section layout)
- Tokens: `design-tokens/tokens.json` (only if consolidating chip/section roles)
- Colocated tests: `agendaStatusChip.test.tsx`, `AgendaFocusCard.test.tsx`,
  `AgendaRow.test.tsx`, `agendaDayGroups.test.ts`, `FamilyScreen.test.tsx`

## Acceptance criteria

- [x] Focus status chips render **uppercase**, **no leading dot**, using
      `feedChip*` typography/padding (WCAG AA on text fills).
- [x] Collapsed `AgendaRow` status chips match Focus/Feeds chip language (not
      Title Case pills).
- [x] `appearance="pill"` is not used on Focus or Agenda rows; pill dot test id
      absent from those surfaces.
- [x] `agendaItemStatusTags` precedence and label semantics unchanged (only
      presentation changes).
- [x] Agenda list uses section labels **NEEDS YOUR ATTENTION**, **REST OF
      TODAY**, **TOMORROW**, **THIS WEEK**, **LATER** (all caps); empty sections
      omitted; **LATER** not “Upcoming”.
- [x] When Focus needs a decision (`focusItemNeedsDecision`), it renders under
      **NEEDS YOUR ATTENTION** as the hero (Accept/Pass/Confirm/etc. included).
- [x] When Focus is calm, it floats above sections with **no** section header
      (not under **REST OF TODAY**).
- [x] Other **NEEDS YOUR ATTENTION** list rows are today + `agendaItemNeedsAttention`
      only (no Accept/Pass on rows); remaining today list rows under **REST OF TODAY**.
- [x] Empty sections are omitted (including no **NEEDS YOUR ATTENTION** when
      Focus is calm and there are no other attention rows).
- [x] Focus item is never duplicated as a collapsed list row.
- [x] Section headers use Feeds section-label styling (uppercase slate), not
      sentence-case primary headings.
- [x] Design docs listed in Approach explicitly supersede Title Case pill
      language for Agenda.
- [x] Component tests would fail if pills or old section labels return;
      `cd web && npm test` (touched suites) + `npm run lint` + `npm run build`
      pass.

## Tasks

- [x] Web: align `AgendaStatusChip` tag mode to `feedChip*` tokens; keep hero
      tone variants; document pill retirement
- [x] Web: switch `AgendaFocusCard` + `AgendaRow` to Feeds-style chips (remove
      `appearance="pill"`)
- [x] Web: add section grouper; decision Focus under **NEEDS YOUR ATTENTION**,
      calm Focus floats above sections; omit empty sections; wire ownRequest /
      ride eligibility for predicates
- [x] Web: render section headers with Feeds section-label styling
- [x] Tokens: consolidate or alias chip/section roles only if needed (regenerate,
      WCAG AA) — not needed; reuse `feedChip*` + `feedSectionLabel*`
- [x] Docs: update coverage / Focus / full-redesign addenda + `ui-system.md`
- [x] Tests: update/add chip + section tests; run web lint, test, build

## Open questions

- None blocking. If mock shows tomorrow date beside **TOMORROW**, keep the
  existing compact date sublabel; primary label stays **TOMORROW**.
