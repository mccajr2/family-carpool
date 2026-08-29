# Spec: weekly-list-focus-sync

Status: draft (planned — next up for `/spec`)  
Created: 2026-08-28  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md), [`unified-ride-status-chip`](../archive/unified-ride-status-chip.md), [`hero-attention-carousel`](../archive/hero-attention-carousel.md)  
Blocks: [`ride-revert-undo`](ride-revert-undo.md), [`attendance-manual-toggle`](attendance-manual-toggle.md) expanded-row UX (stubs reference mock sections deferred here)

## Problem

Agenda list rows are collapsed by default and use unified ride-status chips, but
they still look and behave like generic event rows — not the **GameCard** pattern
from the hero-flow mock. There is no visual link between the carousel’s most
urgent item and its twin in the chronological list, and expanded rows still use
the legacy assign `<select>` + **Assign coverage** pattern instead of
`DriverPicker` (deferred from [`household-driver-assignment`](../archive/household-driver-assignment.md)).

Parents scanning **REST OF TODAY** / **THIS WEEK** cannot tell which row matches
`getQueue(games)[0]` without re-deriving priority locally.

## Non-goals

- Hero carousel ([`hero-attention-carousel`](../archive/hero-attention-carousel.md))
- Replacing [`AgendaWeekGlance`](../../web/src/components/AgendaWeekGlance.tsx) Context aside
- Reordering list by priority (stay chronological within day sections)
- **`RevertRideLink`** expanded copy/actions ([`ride-revert-undo`](ride-revert-undo.md) — rank 3)
- **`AttendanceToggle`** going / not-going UI ([`attendance-manual-toggle`](attendance-manual-toggle.md) — rank 5; keep existing RSVP `<select>` in expanded band for now)
- **`PickupLine`** detour minutes/tone ([`carpool-pickup-detour`](carpool-pickup-detour.md) — rank 6)
- Inbound **Accept / Pass** on expanded rows when the same ask is still in the hero
  carousel (hero wins; expanded row shows summary only for queued asks)
- OpenAPI / backend changes
- iOS / Expo
- Full copy/a11y polish ([`coverage-copy-a11y-polish`](coverage-copy-a11y-polish.md))

## Approach

Restyle collapsed `AgendaRow` to match mock **`GameCard`**, wire **focus highlight**
from shared `getQueue`, and replace expanded assign UI with **`DriverPicker`**
when the row has an own-ride gap. **Visual source:**
[`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) →
`GameCard`, collapsed header, expanded body structure (minus deferred subcomponents).

### Focus sync (behavior)

In `FamilyScreen`, after building `coverageGames` + `queue = getQueue(games)`:

```text
focusedEventKey = queue[0]?.game.id.split(":")[0] ?? null   // calendarItemKey prefix
```

Pass `isFocused={calendarItemKey(item) === focusedEventKey}` into each `AgendaRow`.
**Never** recompute priority in the row — only compare to `queue[0]`.

When the queue is empty, no row is focused. When the focused item is excluded
from the list (carousel spec), highlight is a no-op for that item; the next visible
row is not promoted (highlight applies only when the top queue item’s calendar
row is still in the list — e.g. conflict-only sections or post-carousel edge cases).

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
   gap state. Same handlers as Focus/carousel.
3. **Leave-from / leave-by / conflicts / RSVP** bands: keep existing expanded
   fields below DriverPicker until attendance rank replaces RSVP selects.
4. **Inbound request list** (mock `RequestRow`): new subcomponent or band showing
   each `otherRequests` entry — circle · kids · status chip; **Accept/Pass only**
   when that request is **not** represented in the current hero queue. Pending
   requests already in carousel slides render summary + “Handle in Needs your
   attention above” muted line (or hide actions — pick one in implement; default:
   hide duplicate actions).
5. **Revert links** — omit until `ride-revert-undo`.
6. **Attendance toggle** — omit until `attendance-manual-toggle`.

### Tokens to add/update (same PR)

Lock from mock `GameCard` (do not snap):

| Role | Mock | Notes |
| ---- | ---- | ----- |
| `listRowFocusBorder` | `#E3A15B` | Same amber as mock `C.ring` / carousel `heroRing` |
| `listRowFocusHalo` | `#F4E6D2` | 3px spread (`amberBg`) |
| `listRowPadX` | `24` | `px-6` |
| `listRowPadY` | `20` | `py-5` |
| `listRowTeam` | `12/16/700` uppercase | Feed/team label |
| `listRowTitle` | `18/22/700` | “vs …” line |
| `listRowMeta` | `14/20/400` | Time + location lines |
| `listRowKidAvatar` | `28` | Expanded kid circle |
| `listRowGap` | `12` | `space-y-3` between cards |

Regenerate CSS; WCAG-check focus halo + border on `surfaceRaised`.

### List sections

Keep existing **`groupAgendaListSections`** labels (NEEDS YOUR ATTENTION / REST OF
TODAY / …) — mock’s flat **This week** label is demo simplification only. Rows
render inside current sections unchanged.

No contract changes.

## Context

- **Visual mock:** `docs/ui-system/carpool-hero-flow-mockup-v6.jsx` → `GameCard`,
  `RequestRow` (structure only; detour line deferred)
- Design: `docs/ui-system.md`
- Queue: `web/src/components/coverageQueue.ts` → `getQueue`, `mapCalendarItemToCoverageGames`
- Chips: `web/src/components/rideStatusChip.ts`
- Assign: `web/src/components/DriverPicker.tsx`
- Row: `web/src/components/AgendaRow.tsx`
- Integration: `web/src/components/FamilyScreen.tsx`
- Hero handoff: `docs/specs/archive/hero-attention-carousel.md` (shared `queue` build)
- Tests: `AgendaRow.test.tsx`, `FamilyScreen.test.tsx`

## Acceptance criteria

- [ ] `isFocused` derives only from `getQueue(games)[0]` event key passed by
  `FamilyScreen` — no local priority sort in `AgendaRow`.
- [ ] Focused row shows mock focus ring (`listRowFocusBorder` + 3px
  `listRowFocusHalo`); non-focused rows use normal `border`.
- [ ] Collapsed header matches mock hierarchy: team/feed label, bold title line,
  Clock + when, MapPin + where, chips + chevron; full-width toggle button.
- [ ] Rows default collapsed; expand/collapse unchanged.
- [ ] Expanded own-ride gap uses `DriverPicker` (non-hero); legacy assign
  `<select>` + **Assign coverage** removed for gap state.
- [ ] Multi-kid events: per-kid status in expanded header band when mock shows
  kid row (initial + chip per kid).
- [ ] Inbound request band lists other-circle requests; no duplicate Accept/Pass
  for requests still active in the hero carousel queue.
- [ ] List order remains chronological; section headers unchanged.
- [ ] New list-row tokens locked; `generate.mjs --check` passes.
- [ ] No OpenAPI or backend changes.

## Tasks

- [ ] Tokens: list-row focus + GameCard spacing/type roles from mock
- [ ] Web: `FamilyScreen` — compute `focusedEventKey` from shared `queue`, pass
  `isFocused` to each `AgendaRow`
- [ ] Web: restyle collapsed `AgendaRow` header per mock `GameCard`
- [ ] Web: expanded gap → `DriverPicker`; remove legacy assign dropdown path
- [ ] Web: inbound request summary band (structure from mock `RequestRow`; no
  detour line)
- [ ] Tests: focus ring on/off; focused key tracks `queue[0]`; DriverPicker in
  expanded gap; no Accept on row when ask is in carousel queue

## Open questions

- **Title split:** When `CalendarItem.title` is the only title field, use it as
  the bold “vs …” line and omit a separate team line unless `feedName` exists —
  document in PR if feed/manual events need a follow-up title helper.
- **Queued row exclusion:** After carousel ships, top-priority rows may be
  absent from the list — focus highlight applies only when that calendar key is
  still rendered (expected rare once carousel excludes queue items).
