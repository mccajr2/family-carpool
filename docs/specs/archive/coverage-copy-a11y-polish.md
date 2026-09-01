# Spec: coverage-copy-a11y-polish

Status: done  
Created: 2026-09-01  
Completed: 2026-09-01  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `coverage-copy-a11y-polish`  
Depends on: hero & coverage flow slices through [`carpool-pickup-detour`](../archive/carpool-pickup-detour.md) (functional surfaces exist; polish was deferred in each)

## Problem

The hero & coverage redesign shipped ten functional slices with explicit deferrals
for copy consistency, visual separation of unrelated controls, accessibility, and
narrow-width layout. Microcopy now lives in a dozen scattered modules (`heroAttentionCopy`,
`revertRideCopy`, `rideStatusChip`, `coverageDisplay`, inline component strings) and
drifts — e.g. **Ride needed** vs **Needs coverage**, **Asked the team** vs **Requested**,
week-glance lowercase **needs coverage** vs chip **Needs coverage**.

[ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md) locks a lexical
split: attendance uses **going** / **not going**; ride-side uses **drive** / **driving**.
That split is tested in `AttendanceToggle` and `revertRideCopy` but not audited across
every Agenda surface.

`DriverPicker` household assign vs team ask paths have structural separation (border +
label) but the polish pass from [`household-driver-assignment`](../archive/household-driver-assignment.md)
was deferred. The hero carousel has partial a11y (roledescription, arrow keys, dot tabs)
but suppresses focus outlines, lacks `aria-live` on queue-to-empty transitions, and
decorative rings are not hidden from assistive tech. Chip rows and the carousel scroller
need verified reflow at narrow widths.

**Dark-mode legibility:** hero slides are theme-independent (`heroGlow`, `heroOn`) but
some CTAs pair **page-theme** `--fc-text-primary` with **hero** `--fc-hero-on` (white)
button fills — readable in light mode (ink on white) but near-invisible in dark mode
(white on white). Secondary/meta lines and chip tones on Agenda rows also need verified
contrast in **both** schemes via `design-tokens/contrast.test.mjs` (not only the hero
gradient's darkest stop).

## Non-goals

- **New behavior** — if a one-line copy fix reveals a logic bug, file it against the
  originating slice; do not expand scope here
- [`agenda-ride-rider-chips`](../planned/agenda-ride-rider-chips.md) (rank 2 — not built)
- [`ride-commitment-conflict`](../planned/ride-commitment-conflict.md) (rank 3 — not built)
- Full destination visual restyle ([`ui-system-destination-adoption`](../planned/ui-system-destination-adoption.md) stays parked)
- OpenAPI / backend changes
- Expo / iOS / frozen KMP
- Removing legacy `AgendaFocusCard` / `agendaFocusSelection` (tests-only; separate cleanup)
- Carpool tab, Feeds tab, Family settings — only Calendar Agenda hero + list + week glance

## Approach

**Web-only polish pass** on Calendar Agenda surfaces wired through `FamilyScreen`. No
contract changes.

### 1. Shared copy module

Add `web/src/components/coverageCopy.ts` as the single source for user-facing Agenda
coverage/ride strings. Migrate and re-export from existing helpers where they already
exist (`heroAttentionCopy`, `revertRideCopy` ride-side strings, `rideStatusChip` labels,
`coverageDisplay` agenda tags, `agendaDayGroups` section labels, week-glance day strings,
`AttendanceToggle` labels, inbound handoff copy). Inline literals in `HeroAttentionSlide`,
`AgendaRow`, `AgendaInboundRequestRow`, and `DriverPicker` move into constants.

**Vocabulary rules (locked):**

| Domain | Words | Examples |
| ------ | ----- | -------- |
| Attendance | going, not going | toggle, muted **Not going** chip |
| Ride / transport | drive, driving, ride | **Confirm I'll drive**, **You're driving**, **Ride needed**, **Ask the team for a ride** |
| Coverage API gap | coverage | **Needs coverage**, **Confirm coverage**, **All set** (household responsibility — not ride-side) |

**Unify near-duplicates** (same meaning → one string):

- Ride transport gap chip: **Ride needed** (not **Needs a ride** on inbound chips)
- Open team ask: **Asked the team** everywhere (retire **Requested** on collapsed rows)
- Pending self-confirm chip: **Confirm you'll drive** (matches chip; DriverPicker CTA stays **Confirm I'll drive** — first person is correct on the button)

Week-glance aside copy may stay sentence-lowercase for density (**1 needs coverage** /
**2 need coverage**) but must use the same words as chips (**coverage**, not **ride**).

Section chrome: list sections stay `AGENDA_LIST_SECTION_LABEL` all-caps constants; hero
carousel section label stays Feeds-style uppercase via `feedSectionLabelClass` (source
string can remain sentence case in code).

### 2. `DriverPicker` layout separation

Strengthen household vs team visual hierarchy on both `hero` and list paths without
changing handlers:

- Clear divider + vertical rhythm between household chips/confirm and team fallback
- Team prompt + **Ask the team for a ride** reads as a secondary path (ghost/outline
  weight on list; hero decline-bg treatment retained)
- Household chips + primary confirm grouped as one block

Reuse existing tokens (`--fc-border`, `--fc-space-md`, focus-action weights). Add token
roles only if mock-measured values are missing (unlikely).

### 3. Accessibility

- **Focus rings:** replace `focus:outline-none` on carousel scroller with a visible
  `focus-visible` ring consistent with `Button` / `Input` (`ring-2 ring-ring` or
  `--fc-list-row-focus-border` where on-theme). Dots and `DriverMemberChip` get the
  same visible focus treatment.
- **`aria-live`:** polite region announces when the hero queue transitions to empty
  (**All caught up** / **Nothing needs you right now**) and when a new item appears
  (slide title or **Needs your attention** count change). Avoid noisy re-announce on
  carousel index changes.
- **Carousel labels:** scroller `aria-label` stays; each slide shell gets
  `aria-label` derived from slide title (own-ride gap, inbound ask, pending confirm).
  Dot tabs keep **Go to item N of M**.
- **Decorative:** `HeroAttentionDaysRing` → `aria-hidden`.
- **Chips:** `AgendaStatusChip` tags always include text labels; verify WCAG 3:1 icon
  contrast for tone colors (mint/amber/route/muted) on `surfaceRaised` in **light and
  dark** — adjust token mix only if failing.

### 5. Contrast verification (light + dark)

Run and extend `design-tokens/contrast.test.mjs` — **both** `light` and `dark` schemes
must pass before the PR merges (`node design-tokens/contrast.test.mjs` or via the
design-tokens test script in CI).

**Extend pairings** (add to `heroCarouselPairings` / new `agendaChipPairings` helper):

| Pairing | Why |
| ------- | --- |
| `heroOn` + `heroOnSecondary` on **both** gradient stops `#2A2E63` and `#11131C` | Worst-case meta/context on glow (not only darkest stop) |
| `textPrimary` on `heroOn` (filled hero CTA) — **per scheme** | Catches theme-token bleed on white buttons (dark-mode failure) |
| `heroOn` on `heroDeclineBg` composite (Pass / team ask ghost) | Secondary hero actions |
| `heroOn` on unselected driver chip overlay (`rgba(255,255,255,0.1)` on glow) | DriverPicker hero chips |
| `textPrimary` / tone fills on `surfaceRaised` for each `AgendaStatusChip` tone | Collapsed-row chips in dark mode |

**Fix strategy:** hero-surface controls must not use page-theme `textPrimary` on
`heroOn` fills — use theme-independent ink (e.g. light-scheme `textPrimary` locked to
hero button text, or a dedicated `heroOnInverse` token). Brighten `heroOnSecondary` in
`tokens.json` **dark** only if a pairing still fails after removing theme bleed. WCAG AA
is the allowed exception to mock hex (`docs/ui-system.md`).

**Manual spot-check:** toggle Calendar page theme light ↔ dark with a populated hero
queue; confirm title, context, venue, CTA labels, and empty state are readable.

### 4. Responsive reflow

At viewport widths ≤ 390px (and existing Playwright mobile preset if present):

- Carousel slides remain scrollable; controls do not overflow horizontally
- Collapsed-row chip rows wrap without clipping; expanded `DriverPicker` chips wrap
- Hero slide CTAs remain reachable without horizontal scroll inside the slide

Verify at `md` rail + main frame (signed-in grid), not isolated component width.

## Context

- Design: [`docs/ui-system.md`](../../ui-system.md) — focus ring / WCAG AA
- Contrast gate: `design-tokens/contrast.test.mjs` (runs `light` + `dark` loops)
- ADR: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md) — going vs drive
- Contract notes: [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md) — tag precedence
- Archived deferrals: [`hero-attention-carousel`](../archive/hero-attention-carousel.md),
  [`household-driver-assignment`](../archive/household-driver-assignment.md),
  [`unified-ride-status-chip`](../archive/unified-ride-status-chip.md),
  [`weekly-list-focus-sync`](../archive/weekly-list-focus-sync.md),
  [`ride-revert-undo`](../archive/ride-revert-undo.md),
  [`attendance-manual-toggle`](../archive/attendance-manual-toggle.md),
  [`auto-decline-unofferable`](../archive/auto-decline-unofferable.md)
- Source:
  - `web/src/components/coverageCopy.ts` (new)
  - `web/src/components/HeroAttentionCarousel.tsx`
  - `web/src/components/HeroAttentionSlide.tsx`
  - `web/src/components/HeroAttentionDaysRing.tsx`
  - `web/src/components/DriverPicker.tsx`
  - `web/src/components/AgendaRow.tsx`
  - `web/src/components/AgendaInboundRequestRow.tsx`
  - `web/src/components/agendaStatusChip.tsx`
  - `web/src/components/rideStatusChip.ts`
  - `web/src/components/coverageDisplay.ts`
  - `web/src/components/heroAttentionCopy.ts`
  - `web/src/components/revertRideCopy.ts`
  - `web/src/components/AttendanceToggle.tsx`
  - `web/src/components/agendaWeekGlanceDays.ts`
  - `web/src/components/agendaDayGroups.ts`
  - `design-tokens/tokens.json` — hero/chip token adjustments if contrast fails
  - `design-tokens/contrast.test.mjs` — extended pairings

## Acceptance criteria

- [x] `coverageCopy.ts` exports all Agenda coverage/ride user strings listed in Approach §1; no duplicate literals for those strings in the files above (grep CI-friendly)
- [x] Attendance strings use **going** / **not going** only; ride strings use **drive** / **driving** / **ride** — no cross-domain bleed (e.g. no **Confirm going** on DriverPicker)
- [x] Collapsed ride gap chip is **Ride needed**; open team ask chip is **Asked the team** (not **Requested**)
- [x] Week-glance flagged days use **needs coverage** / **need coverage** wording (not **ride**)
- [x] `DriverPicker` household block and team fallback are visually distinct on hero and list paths (divider + spacing); `data-testid="driver-picker-team-section"` unchanged
- [x] Carousel scroller, dot tabs, and driver chips show visible keyboard focus (not `outline-none` without substitute)
- [x] `aria-live="polite"` announces hero empty state when queue goes from ≥1 item to 0; does not fire on carousel slide index changes alone
- [x] `HeroAttentionDaysRing` is `aria-hidden`
- [x] Each hero slide has an accessible name (title-derived `aria-label` on slide shell)
- [x] At 390px width, carousel controls and collapsed chip rows render without horizontal overflow/clipping (manual or Playwright)
- [x] Hero slide CTAs and filled buttons use theme-independent text on `heroOn` fills — no `textPrimary` on white in dark mode
- [x] `design-tokens/contrast.test.mjs` passes for **both** `light` and `dark` including extended hero gradient stops, hero CTA pairings, and Agenda chip tones on `surfaceRaised`
- [x] Manual light/dark spot-check on Calendar: hero queue slides + empty state text readable
- [x] Existing component tests updated; new `coverageCopy.test.ts` locks vocabulary split and unified labels
- [x] `npm run lint` + `npm test` pass in `web/`; design-tokens contrast tests pass

## Tasks

- [x] Web: add `coverageCopy.ts`; migrate strings from listed modules; re-export or thin-wrap existing helpers
- [x] Web: unify chip labels in `rideStatusChip.ts` / `coverageDisplay.ts` to constants
- [x] Web: `DriverPicker` separation polish (hero + list)
- [x] Web: hero carousel a11y — focus rings, `aria-live`, slide `aria-label`s, days ring `aria-hidden`
- [x] Web: responsive checks — carousel, chips, `DriverPicker` at narrow width
- [x] Web: fix hero CTA / filled-button text — theme-independent ink on `heroOn` (dark-mode legibility)
- [x] Tokens: extend `contrast.test.mjs` pairings; fix failing `tokens.json` roles for light + dark
- [x] Web: `AgendaStatusChip` tone contrast verify (token tweak only if failing)
- [x] Tests: `coverageCopy.test.ts` — vocabulary + label constants
- [x] Tests: update `HeroAttentionCarousel.test.tsx`, `DriverPicker.test.tsx`, `AgendaRow.test.tsx`, `rideStatusChip` / chip tests for new strings and a11y attributes

## Open questions

- None — week-glance lowercase density and hero section uppercase-via-CSS are intentional.
- Dark-mode hero legibility root cause is theme-token bleed on hero fills; fix via
  theme-independent button text, not by making the whole page light when hero is shown.
