# Spec: hero-attention-carousel

Status: draft  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `hero-attention-carousel`  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md), [`unified-ride-status-chip`](../archive/unified-ride-status-chip.md)  
Governs: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md)

## Problem

The Calendar hero still uses `selectFocusItem` — one promoted `CalendarItem` at a
time — so a parent cannot see or act on the second (or third) urgent item until
the first is resolved. That selection also follows today/tomorrow bucket rules
from the pre-redesign addendum, which diverges from the shared
[`getQueue`](../../web/src/components/coverageQueue.ts) ordering locked in
[ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md) (own-child ride
gaps always before pending carpool requests, soonest-first within each tier).

The priority engine, unified chips, and `DriverPicker` are shipped; the hero
surface must now render the full attention queue as a swipeable carousel where
**every slide is independently actionable**.

## Non-goals

- Collapsed-by-default agenda rows, row highlight sync to `getQueue[0]`, or list
  reorder ([`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md) —
  rank 2; mock `GameCard` — **spec drafted** with same mock)
- One-click ride reverts and ride-side **drive** copy pass
  ([`ride-revert-undo`](../planned/ride-revert-undo.md)) — no revert links on
  carousel slides
- Pickup town + **detour minutes / tone line** on carpool ask slides
  ([`carpool-pickup-detour`](../planned/carpool-pickup-detour.md) — use existing
  pickup place + address summary only; mock `PickupLine` detour copy is deferred)
- Manual not-going toggle on carousel slides
  ([`attendance-manual-toggle`](../planned/attendance-manual-toggle.md))
- Surfacing **calendar conflicts** in the carousel (`getQueue` does not include
  them; **Overlaps** rows stay in the flat list)
- A calm “next event to leave for” hero when the queue is empty (empty queue →
  mock **All caught up** hero — still on `heroGlow`, not a flat list row)
- Context-aside ask inbox or a second hero outside the carousel
- Gating CTAs on slide #1 (slide 2+ must Accept/Decline / assign / confirm like
  slide 1)
- Status chips on carousel slides (mock hero is title + meta + CTA only)
- OpenAPI / backend changes
- iOS / Expo
- Full carousel a11y/responsive polish ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))

## Approach

Replace the single `AgendaFocusCard` wired through `selectFocusItem` in
`FamilyScreen` with a **Needs your attention** carousel driven exclusively by
`getQueue`. **Visual source:** [`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) — lock measured values into `design-tokens/tokens.json` in the same PR (`docs/ui-system.md`; do not snap to nearby roles).

**Data path (no duplicate sort/filter)**

1. `mapCalendarItemsToCoverageGames(visibleCalendarItems, rideEventForItem, options)`
   → `CoverageGameEvent[]` (respect kid filter).
2. `getQueue(games)` → `QueueItem[]`.
3. Carousel renders **one slide per queue item** in array order.

### Carousel shell (`HeroCarousel` in mock → `HeroAttentionCarousel.tsx`)

- Section label above carousel: **NEEDS YOUR ATTENTION** — mock
  `text-xs uppercase tracking-widest font-semibold`, `textSecondary`, `mb-3`
  (reuse `feedSectionLabelClass`).
- **Mechanism:** native horizontal scroll — `overflow-x: auto`,
  `scroll-snap-type: x mandatory`, `scrollbar-width: none` (WebKit scrollbar
  hidden). Track: `flex` + `gap-4` (16px). No carousel library.
- **Slide width:** `min(640px, 84vw)` per slide; `scroll-snap-align: center`;
  `shrink-0`.
- **Scroll sync:** `onScroll` picks closest slide for active index; arrow/dot
  clicks use `scrollIntoView({ behavior: "smooth", inline: "center" })`.
- **Controls** (only when `queue.length > 1`): row below scroller,
  `flex items-center justify-center gap-3 mt-3`:
  - Chevron buttons: `rounded-full p-1.5`, `grayBg` fill (`#ECEBE6` → token),
    `disabled:opacity-30`, lucide `ChevronLeft` / `ChevronRight` 16px.
  - Dot indicators: inactive `7×7` circle `#C9C6BC`; active `18×7` pill `ink`
    (`#15161C` → `textPrimary`); `transition-all`; each dot
    `aria-label="Go to item {i+1} of {n}"`.
- Keyboard: left/right when carousel region focused (same as arrow buttons).

### Empty queue (`cardCount === 0` in mock)

Single full-width hero card — **still uses `heroGlow`**, not calm
`surfaceRaised`:

- `rounded-2xl p-8`, white text, `heroGlow` background.
- Row: `CheckCircle2` 28px in `heroSuccess` green + uppercase **All caught up**
  (`tracking-widest`, muted secondary on hero).
- Title (`focusTitle` scale): **Nothing needs you right now**
- Body (`heroOnSecondary`): **Every ride this week is either covered or waiting
  on someone else. We'll bring the next thing here the moment it needs a
  decision from you.**
- No dots, arrows, or carousel chrome.

### Slide body (`HeroSlide` in mock → `HeroAttentionSlide.tsx`)

Each slide: `rounded-2xl p-7`, `heroGlow` fill, white text, `overflow-hidden`,
`h-full`. Layout: flex row — content left, countdown ring right.

**Priority chrome** (`text-xs uppercase tracking-widest`):

| Index | Chrome |
| ----- | ------ |
| `0` | **Most urgent** pill — `rounded-full px-2 py-0.5`, bg `rgba(227,161,91,0.18)`; when `queue.length > 1` append muted **· {n} things need you** |
| `≥ 1` | Muted **Up next** (no pill) |

**`ownRide` slide copy** (from mock — not raw `CalendarItem.title`):

- H2 (`text-3xl font-bold`, `focusTitle`): **{kid first name} needs a ride**
- Line 1 (`heroOnSecondary`): `{team/feed label} vs {opponent or title}` ·
  `{formatted when}`
- Line 2 (sm, muted): `{venue / location}`
- CTA: `DriverPicker` with **`hero={true}`** (dark-on-hero styling per mock
  `DriverPicker` `dark` prop — white/ink chips, white primary confirm, divided
  “Nobody in the household free?” team-ask section)

**`request` slide copy:**

- H2: **{requesting circle} need a ride for {kid first name(s)}**
- Line 1: event context (team · when) — same pattern as ownRide
- Line 2: `{venue} · {your kid} is already going`
- Pickup summary: existing `incomingRideAskSummary` fields (place + address) —
  **no** detour minutes/tone until `carpool-pickup-detour`
- CTAs (`flex gap-3 mt-6`):
  - **Accept:** `rounded-xl px-5 py-3 font-semibold`, white bg, ink text
  - **Decline:** `rounded-xl px-5 py-3 font-semibold`, `rgba(255,255,255,0.12)`
    bg, white text (+ vehicle picker when multiple eligible vehicles, same logic
    as today’s Focus Accept)

**Countdown ring** (mock `CountdownRing` — **not** the leave-by fractional ring
on shipped `AgendaFocusCard`):

- `84×84` circle, `3px` solid **`heroRing`** (`#E3A15B`), white label
- Center: whole **days until event** (local calendar days; `1` → **DAY**,
  else **DAYS**); reuse/adapt `formatRingCountdown` or add `formatHeroDaysRing`
- Decorative — not a literal leave-by guarantee (same a11y posture as Focus
  ring addendum)

Resolve backing `CalendarItem` + `CarpoolRideEvent` from
`queueItem.game.id` (`{eventKey}:{kidId}`). Kid-subset for assign defaults to
**`[queueItem.game.kidId]`** only.

### Tokens to add/update (same PR)

Lock mock measurements — do not reuse `heroSurface` solid fill for carousel
slides; mock uses a **gradient**:

| Role | Mock value | Notes |
| ---- | ---------- | ----- |
| `heroGlow` | `radial-gradient(120% 140% at 85% 0%, #2A2E63 0%, #11131C 55%)` | Slide + empty-state background (CSS var) |
| `heroRing` | `#E3A15B` | Days countdown ring stroke |
| `heroMostUrgentBadge` | `rgba(227,161,91,0.18)` | “Most urgent” pill fill |
| `heroCarouselGap` | `16` | Track gap between slides |
| `heroCarouselSlideMax` | `640` | px max slide width |
| `heroCarouselSlideVw` | `84` | vw cap |
| `heroSlidePad` | `28` | `p-7` |
| `heroEmptyPad` | `32` | `p-8` |
| `heroCarouselDotInactive` | `#C9C6BC` | Inactive dot |
| `heroCarouselDotActiveW` | `18` | Active dot width |
| `heroCarouselDotH` | `7` | Dot height |
| `heroCarouselControlBg` | `#ECEBE6` | Chevron button fill |
| `heroDeclineBg` | `rgba(255,255,255,0.12)` | Decline button on hero |

Regenerate `tokens.generated.css` after edits. WCAG-check white-on-gradient
text pairings; adjust only if AA fails.

### List integration (minimal — full list UX is rank 2)

- Remove `selectFocusItem` / single `focusItem` from `FamilyScreen`.
- Exclude from the flat agenda list any `CalendarItem` whose key appears in the
  queue (any kid row on that event is in `getQueue`).
- Carousel always renders **above** day sections.
- Update `groupAgendaListSections`: pass `queueHasItems: queue.length > 0`
  instead of `focusNeedsDecision`.
- Leave `AgendaRow` expand/collapse unchanged (rank 2).

### Retire for hero wiring

- `selectFocusItem` usage in `FamilyScreen` (keep module + tests until rank 2).
- Single-item Focus selection in
  [`docs/agenda-focus-card-addendum.md`](../../agenda-focus-card-addendum.md) —
  add supersession note → this spec + ADR-0001.
- `AgendaFocusCard` as the hero entry point (may remain for handler reuse /
  refactor into slide body).

No contract changes.

## Context

- **Visual mock:** `docs/ui-system/carpool-hero-flow-mockup-v6.jsx` →
  `HeroCarousel`, `HeroSlide`, `CountdownRing`, empty state, carousel controls
- Design: `docs/ui-system.md` → Visual source of truth, hero tokens
- Decision: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md)
- Prior hero rules superseded: `docs/agenda-focus-card-addendum.md` → New rule
- View-model: `web/src/components/coverageQueue.ts`
- Chips (list rows only, not carousel): `web/src/components/rideStatusChip.ts`
- Assign UX: `web/src/components/DriverPicker.tsx` (extend `hero` dark styling
  to match mock)
- Handler reference: `web/src/components/AgendaFocusCard.tsx`
- List sections: `web/src/components/agendaDayGroups.ts`
- Integration: `web/src/components/FamilyScreen.tsx`
- Legacy selection: `web/src/components/agendaFocusSelection.ts`
- Tokens: `design-tokens/tokens.json`, `web/src/styles/tokens.generated.css`

## Acceptance criteria

- [ ] Hero builds `getQueue` from `mapCalendarItemsToCoverageGames`; no local
  re-sort/filter.
- [ ] Carousel matches mock shell: scroll-snap track, `min(640px, 84vw)` slides,
  hidden scrollbar, 16px gap; arrows + pill/circle dots when `n > 1`; no
  controls when `n === 1`.
- [ ] Active dot and arrow state follow scroll position; arrow/dot navigation
  smooth-scrolls to the target slide.
- [ ] Slide `0`: **Most urgent** pill + **· {n} things need you** when
  `n > 1`; slides `≥ 1`: muted **Up next**.
- [ ] Empty queue: mock **All caught up** hero (`heroGlow`, check icon, title +
  body copy above) — not calm `surfaceRaised`, not old all-set Focus.
- [ ] Slides use `heroGlow` gradient, `p-7`, mock title/meta copy for `ownRide`
  and `request` kinds (not generic event title as H2).
- [ ] Days countdown ring: 84px, 3px `heroRing` stroke, DAY/DAYS label per mock.
- [ ] `ownRide` slides: `DriverPicker` hero styling matches mock dark chips +
  divided team-ask section; kid subset locked to slide kid.
- [ ] `request` slides: Accept / Decline styling per mock; Pass uses Decline
  handler; vehicle picker when needed.
- [ ] Every slide actionable without clearing slide 0; resolving one slide
  removes it on next render.
- [ ] Queued calendar items omitted from flat list; conflict-only rows remain.
- [ ] Kid filter narrows queue and list consistently.
- [ ] New token roles locked from mock; `generate.mjs --check` passes.
- [ ] No OpenAPI or backend changes.

## Tasks

- [x] Tokens: add hero carousel roles from mock table; regenerate CSS
- [x] Web: `HeroAttentionCarousel` + `HeroAttentionSlide` per mock
- [x] Web: extend `DriverPicker` `hero` styling to match mock `dark` variant
- [x] Web: days ring helper (or adapt `agendaFocusRing.ts`) for carousel
- [x] Web: wire `FamilyScreen` — games → `getQueue`, carousel, list exclusion
- [ ] Web: `groupAgendaListSections` `queueHasItems` + carousel-always-above
- [ ] Docs: supersession note in `docs/agenda-focus-card-addendum.md`
- [ ] Tests: carousel shell (dots, arrows, snap index); empty hero copy; slide
  labels; per-slide CTAs; list exclusion; token/CSS smoke via existing generate
  test; update `FamilyScreen.test.tsx`

## Open questions

- **Slide height:** Default — slides stretch to content; carousel controls sit
  below the scroller (mock pattern). Do not fixed-height all slides unless dot
  row jumps in dogfood — then set `min-height` from tallest slide only.
