# Spec: weekly-list-focus-sync

Status: done  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `weekly-list-focus-sync`  
Depends on: [`hero-attention-carousel`](../archive/hero-attention-carousel.md), [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md), [`unified-ride-status-chip`](../archive/unified-ride-status-chip.md)  
Blocks: [`ride-revert-undo`](../planned/ride-revert-undo.md), [`attendance-manual-toggle`](../planned/attendance-manual-toggle.md) expanded-row UX (stubs reference mock sections deferred here)  
Governs: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md)

## Problem

[`hero-attention-carousel`](../archive/hero-attention-carousel.md) ships the
**Needs your attention** carousel and **All caught up** empty hero (no calm
“next event” card). Agenda list rows are collapsed by default with unified
chips, but they still look like generic event rows — not the mock **`GameCard`**
pattern — and the carousel temporarily **excludes** queue calendar items from
the flat list (`queuedCalendarItemKeys` filter in `FamilyScreen`).

The mock shows every game in the chronological **This week** list with an amber
focus ring on `getQueue(games)[0]`, while the carousel handles actions above.
Without list inclusion + focus sync, parents scanning **REST OF TODAY** /
**THIS WEEK** cannot see which row matches the most urgent queue item. Expanded
rows still use the legacy assign `<select>` + **Assign coverage** instead of
`DriverPicker` (deferred from [`household-driver-assignment`](../archive/household-driver-assignment.md)).

## Non-goals

- Hero carousel shell, slides, or **All caught up** copy ([`hero-attention-carousel`](../archive/hero-attention-carousel.md) — done)
- Calm “next event” hero — retired; empty `getQueue` → **All caught up** only
- Replacing [`AgendaWeekGlance`](../../web/src/components/AgendaWeekGlance.tsx) Context aside
- Reordering list by priority (stay chronological within day sections)
- Highlight tracking the **active carousel slide** — mock + roadmap lock **`getQueue[0]`** only (list anchor stays on most urgent while user swipes other slides)
- **`RevertRideLink`** expanded copy/actions ([`ride-revert-undo`](../planned/ride-revert-undo.md) — rank 2)
- **`AttendanceToggle`** going / not-going UI ([`attendance-manual-toggle`](../planned/attendance-manual-toggle.md) — rank 4; keep existing RSVP `<select>` in expanded band for now)
- **`PickupLine`** detour minutes/tone ([`carpool-pickup-detour`](../planned/carpool-pickup-detour.md) — rank 5)
- Inbound **Accept / Pass** on expanded rows when the same ask is still in the hero
  carousel (hero wins; expanded row shows summary only for queued asks)
- OpenAPI / backend changes
- iOS / Expo
- Full copy/a11y polish ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))

## Approach

Restyle collapsed `AgendaRow` to match mock **`GameCard`**, restore **full list
inclusion** (undo carousel list exclusion), wire **focus highlight** from shared
`getQueue[0]`, and replace expanded assign UI with **`DriverPicker`** when the
row has an own-ride gap. **Visual source:**
[`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) →
`GameCard`, collapsed header, expanded body structure (minus deferred subcomponents).

### Focus sync (behavior)

In `FamilyScreen`, reuse the existing `coverageGames` + `attentionQueue` build
(already shared with `HeroAttentionCarousel`):

```text
focusedCalendarItemKey =
  attentionQueue[0] != null
    ? coverageGameEventKey(attentionQueue[0].game.id)
    : null
```

Pass `isFocused={calendarItemKey(item) === focusedCalendarItemKey}` into each
`AgendaRow`. **Never** recompute priority in the row — only compare to
`attentionQueue[0]`.

When the queue is empty, no row is focused (hero shows **All caught up**).

### List inclusion (supersedes carousel minimal exclusion)

**Remove** the `listCalendarItems` filter that drops queue calendar keys.
Pass **`agendaWindowItems`** (or equivalent full in-window set) into
`groupAgendaListSections`. Queue items appear **both** in the carousel and as
collapsed rows in their chronological section — matching the mock’s
`sorted.map(… GameCard …)` under **This week**.

Update `groupAgendaListSections` / tests as needed: when `queueHasItems`, today
attention rows that are also in the queue remain in **REST OF TODAY** (carousel
owns **NEEDS YOUR ATTENTION** chrome; list does not duplicate that header).

### Collapsed row (`GameCard` header — mock lines 428–441)

Replace current single title + time line with mock hierarchy on **`surfaceRaised`** card:

| Element | Mock | Implementation notes |
| ------- | ---- | -------------------- |
| Container | `rounded-2xl bg-white`, `px-6 py-5` | Lock `listRowPadX` 24, `listRowPadY` 20, `radius.xl` |
| Focus ring | `border` `#E3A15B` + `box-shadow: 0 0 0 3px #F4E6D2` | Tokens `listRowFocusBorder`, `listRowFocusHalo`; only when `isFocused` |
| Feed label | `text-xs uppercase tracking-wide font-semibold` sub | `feedName` or `calendarSourceLabel` + feed name |
| Title | `text-lg font-bold` **vs {opponent}** | Use `item.title` as opponent line when no split field exists; prefer `{feedName}` as team line when `item.feedName` present |
| When | `text-sm` + `Clock` 14px · date · time | `formatEventWhen`; icon via `uiIcons` |
| Where | `text-sm` + `MapPin` 14px · location | `item.location` when set |
| Right cluster | `StatusChip` + `CarpoolAskChip` + chevron | Existing `rideStatusChipsForItem` + `carpoolAskChipForRideEvent`; chevron up/down 18px per mock (rotate when open) |
| Tap target | Full-width `<button>` | Keep `aria-expanded`; preserve no `truncate` on title (grid min-content rule) |

Default state: **collapsed** (`useState(false)` — already shipped).

### Expanded body (mock lines 443–468 — partial)

Align band **order** with mock where components exist:

1. **Per-kid row** (when not out-of-play): kid initial circle (`28×28`, accent fill) +
   name + `StatusChip` for that kid’s game row — use
   `mapCalendarItemToCoverageGames` per kid when multi-kid.
2. **`DriverPicker`** (light / non-hero): when row has own-ride gap
   (`unassigned` or pending household confirm for any in-play kid) — **replaces**
   expanded assign `<select>` + **Assign coverage** + standalone Request band for
   gap state. Same handlers as carousel slides.
3. **Leave-from / leave-by / conflicts / RSVP** bands: keep existing expanded
   fields below DriverPicker until attendance rank replaces RSVP selects.
4. **Inbound request list** (mock `RequestRow`): new subcomponent or band showing
   each `otherRequests` entry — circle · kids · status chip; **Accept/Pass only**
   when that request is **not** represented in the current hero queue. Pending
   requests already in carousel slides render summary + muted
   “Handle in Needs your attention above” line (default: hide duplicate actions).
5. **Revert links** — omit until `ride-revert-undo`.
6. **Attendance toggle** — omit until `attendance-manual-toggle`.

### Tokens to add/update (same PR)

Lock from mock `GameCard` (do not snap):

| Role | Mock | Notes |
| ---- | ---- | ----- |
| `listRowFocusBorder` | `#E3A15B` | Same amber as mock `C.ring` / carousel `heroRing` |
| `listRowFocusHalo` | `#F4E6D2` | 3px spread (`amberBg`); width locked as `listRowFocusHaloSpread` |
| `listRowPadX` | `24` | `px-6` |
| `listRowPadY` | `20` | `py-5` |
| `listRowTeam` | `12/16/700` uppercase | Feed/team label |
| `listRowTitle` | `18/22/700` | “vs …” line |
| `listRowMeta` | `14/20/400` | Time + location lines |
| `listRowKidAvatar` | `28` | Expanded kid circle |
| `listRowGap` | `12` | `space-y-3` between cards |
| `listRowFocusHaloSpread` | `3` | Box-shadow spread for focus halo |

Regenerate CSS; WCAG-check focus halo + border on `surfaceRaised`.

### List sections

Keep existing **`groupAgendaListSections`** labels (NEEDS YOUR ATTENTION / REST OF
TODAY / …). Mock’s flat **This week** label is demo simplification only.

No contract changes.

## Context

- **Visual mock:** `docs/ui-system/carpool-hero-flow-mockup-v6.jsx` → `GameCard`,
  `RequestRow` (structure only; detour line deferred)
- Design: `docs/ui-system.md`
- Queue: `web/src/components/coverageQueue.ts` → `getQueue`, `coverageGameEventKey`, `mapCalendarItemToCoverageGames`
- Carousel (done): `web/src/components/HeroAttentionCarousel.tsx`, `HeroAttentionSlide.tsx`
- Chips: `web/src/components/rideStatusChip.ts`
- Assign: `web/src/components/DriverPicker.tsx`
- Row: `web/src/components/AgendaRow.tsx`
- Integration: `web/src/components/FamilyScreen.tsx`
- Sections: `web/src/components/agendaDayGroups.ts`
- Hero handoff: `docs/specs/archive/hero-attention-carousel.md`
- Tests: `AgendaRow.test.tsx`, `FamilyScreen.test.tsx`

## Acceptance criteria

- [x] Queue calendar items render in the flat list **and** in the carousel (list exclusion removed).
- [x] `isFocused` derives only from `attentionQueue[0]` via `coverageGameEventKey` —
  no local priority sort in `AgendaRow`.
- [x] Focused row shows mock focus ring (`listRowFocusBorder` + 3px
  `listRowFocusHalo`); non-focused rows use normal `border`.
- [x] When `attentionQueue` is empty, no row is focused; hero remains **All caught up**.
- [x] Collapsed header matches mock hierarchy: team/feed label, bold title line,
  Clock + when, MapPin + where, chips + chevron; full-width toggle button.
- [x] Rows default collapsed; expand/collapse unchanged.
- [x] Expanded own-ride gap uses `DriverPicker` (non-hero); legacy assign
  `<select>` + **Assign coverage** removed for gap state.
- [ ] Multi-kid events: per-kid status in expanded header band when mock shows
  kid row (initial + chip per kid).
- [x] Inbound request band lists other-circle requests; no duplicate Accept/Pass
  for requests still active in the hero carousel queue.
- [x] List order remains chronological; section headers unchanged.
- [x] New list-row tokens locked; `generate.mjs --check` passes.
- [x] No OpenAPI or backend changes.
- [x] `npm run lint`, `npm test`, and `npm run build` pass in `web/`.

## Tasks

- [x] Tokens: list-row focus + GameCard spacing/type roles from mock
- [x] Web: `FamilyScreen` — remove queue list exclusion; compute `focusedCalendarItemKey` from `attentionQueue[0]`; pass `isFocused` to each `AgendaRow`
- [x] Web: restyle collapsed `AgendaRow` header per mock `GameCard`
- [x] Web: expanded gap → `DriverPicker`; remove legacy assign dropdown path
- [x] Web: inbound request summary band (structure from mock `RequestRow`; no detour line)
- [x] Web: `groupAgendaListSections` / tests — queue items in list with carousel above
- [x] Tests: focus ring on/off; focused key tracks `queue[0]`; queue item in list + carousel; DriverPicker in expanded gap; no Accept on row when ask is in carousel queue

## Open questions

- **Title split:** When `CalendarItem.title` is the only title field, use it as
  the bold “vs …” line and omit a separate team line unless `feedName` exists —
  document in PR if feed/manual events need a follow-up title helper.
