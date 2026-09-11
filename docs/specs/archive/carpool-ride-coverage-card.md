# Spec: carpool-ride-coverage-card

Status: archived  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Updated: 2026-09-11 (`/pr` — archive after ship)  
Added: 2026-09-10 · re-rank split  
Branch: `carpool-ride-coverage-card`

## Problem

Per-leg domain and dual status chips already ship
([`carpool-leg-to-from`](../archive/carpool-leg-to-from.md)), but the Calendar
coverage assign chrome still treats **Ask the team** as a secondary band and
does not make **self round-trip confirm from the household leave-from** the
clearest primary path. Driver selection, leave-from, and Confirm / Post labels
need one default collapsed layout on Focus/Hero and Agenda expanded rows.

## Non-goals

- Per-leg split editor (Getting there / Coming back sections, Save ride plan,
  Back to simple view) —
  [`carpool-leg-split-plans`](../planned/carpool-leg-split-plans.md)
- Per-kid progressive split —
  [`carpool-kid-split-plans`](../planned/carpool-kid-split-plans.md)
- Ask-the-team radius / meet-at sub-flow —
  [`carpool-meet-at`](../planned/carpool-meet-at.md) (Ask the team stays a
  **plain** undifferentiated round-trip request)
- Domain leg persistence, four-state chip model, combined cancel, RSVP
  not-going clears legs — already done in
  [`carpool-leg-to-from`](../archive/carpool-leg-to-from.md)
- Collapsing matching TO/FROM chips to a single Round trip chip —
  [`carpool-leg-chip-collapse`](../planned/carpool-leg-chip-collapse.md)
  (dual chips stay as shipped until that id)
- OpenAPI / backend coverage or carpool write-path changes
- Expo / push / KMP UI
- Carpool tab visual restyle —
  [`carpool-page-redesign`](../planned/carpool-page-redesign.md)
- Changing which items enter the hero queue or coverage priority ranking
- Removing one-time leave-from (keep existing combobox option; see Approach)

## Approach

**Web-only** restyle and wire of the existing assign stack. Reuse
`DriverPicker`, `LeaveFromControls`, and `coverageCopy` — do **not** fork a
second coverage/ask UI. **No contract or backend changes**; Confirm still
assigns / confirms coverage (and commits leave-from draft when needed); Ask
the team still creates the existing plain round-trip team request for all
**going** siblings together.

### Default collapsed chrome (this PR)

Surfaces that already show `DriverPicker` for an uncovered own-ride gap:

1. **Focus / Hero** (attention carousel + Focus card)
2. **Agenda expanded** rows that mount the same picker

Layout (top → bottom):

1. **Driver row** — one chip per household/circle adult (dynamic: 1, 2, 3+),
   default selection = logged-in adult (**You**), plus exactly one trailing
   **Ask the team** chip in the same row (not a separate footer button band).
2. **Leave from** — existing single combobox (`LeaveFromControls`): membership
   default pre-selected; other located saved places as options; keep the
   existing **One-time address…** option inside the same combobox (already
   wired; cheaper than removing it). No separate “other location” control
   outside the combobox.
3. **Primary button** — label updates live from Driver + Leave-from:
   - Household self / other adult →  
     `Confirm — You'll drive round trip from {origin}` /  
     `Confirm — {First}'ll drive round trip from {origin}`  
     (origin from resolved place name or live one-time draft / placeholder)
   - **Ask the team** selected → `Post to team — round trip`  
     (pressing the button posts; no meet-at sub-options)
4. **“Different plans for each leg.”** — plain text link **below** the primary
   button. Visible for progressive disclosure; **does not open** the split
   editor in this PR (wire in `carpool-leg-split-plans`). Prefer
   `aria-disabled` / non-activating control so it is not a dead navigation.

Remove the current team footer pattern (**Nobody in the household free?** +
outline **Ask the team for a ride** button) from these DriverPicker surfaces
once Ask the team is a trailing chip.

Pending-for-you Confirm/Decline (no changeable driver) and settled covering
chrome stay as they are unless they share broken copy with the new confirm
helpers — do not redesign those states in this slice.

Update `docs/agenda-coverage-web-contract.md` (DriverPicker / leave-from Focus
+ expanded Agenda sections) so the web contract matches the new chrome. No new
destination mock with locked type/spacing/color for this slice — reuse existing
Focus/Agenda tokens; only add/update `design-tokens/tokens.json` roles if a
real visual delta cannot reuse an existing role (do not snap to a nearby size).

## Context

Allowlist for `/implement`:

- Goals source: Ride Coverage Card UI notes in prior `/spec` thread (default
  view only; split view is the next id) — summarized in Approach above
- Prior ship: `docs/specs/archive/carpool-leg-to-from.md` (legs + chips already
  done; do not re-litigate)
- Prior ship: `docs/specs/archive/ride-cards-cleanup.md`,
  `docs/specs/archive/coverage-leave-from.md`,
  `docs/specs/archive/household-driver-assignment.md`,
  `docs/specs/archive/coverage-copy-a11y-polish.md`
- Contract UX: `docs/agenda-coverage-web-contract.md` → Leave-from (Focus /
  hero + expanded Agenda DriverPicker); Coverage assign / Ask the team
- Design tokens: `design-tokens/tokens.json` only if a new role is required
- Source:
  - `web/src/components/DriverPicker.tsx` (+ `.test.tsx`)
  - `web/src/components/LeaveFromControls.tsx`
  - `web/src/components/coverageCopy.ts` (+ `.test.ts`)
  - `web/src/components/leaveFromDisplay.ts`
  - `web/src/components/AgendaFocusCard.tsx` (+ `.test.tsx`)
  - `web/src/components/HeroAttentionSlide.tsx` / carousel tests as needed
  - `web/src/components/AgendaRow.tsx` (+ `.test.tsx`) where expanded
    DriverPicker mounts

Do not load `docs/roadmap.md` or whole-architecture dumps. Do not implement
`carpool-leg-split-plans` or `carpool-meet-at`.

## Acceptance criteria

- [x] Focus/Hero and Agenda expanded uncovered own-ride DriverPicker surfaces
      show household adult chips (dynamic count) with default = signed-in adult,
      plus a trailing **Ask the team** chip in the same driver row (no separate
      team footer button / “Nobody in the household free?” band on those
      surfaces).
- [x] Leave-from remains a single combobox with default pre-selected, other
      located places selectable, and existing one-time address option inside the
      combobox; Confirm / Post label origin updates live (including one-time
      draft / empty placeholder).
- [x] Primary button copy updates live: household selection →  
      `Confirm — … round trip from {origin}`; Ask the team →  
      `Post to team — round trip`. Confirm still commits coverage + leave-from
      draft as today; Post still creates a plain round-trip team ask for all
      going siblings (no meet-at UI).
- [x] **“Different plans for each leg.”** appears below the primary button and
      does not open a split editor in this PR.
- [x] No OpenAPI / backend changes; dual leg status chips and other
      post-plan chrome from `carpool-leg-to-from` remain unchanged.
- [x] `docs/agenda-coverage-web-contract.md` documents the new DriverPicker
      chrome for Focus/Hero + expanded Agenda.
- [x] Component/unit tests cover chip selection (self default, Ask the team),
      live Confirm / Post labels, and presence of the non-activating Different
      plans link; relevant web suite passes.

## Tasks

- [x] Docs: this spec; update `docs/agenda-coverage-web-contract.md` DriverPicker
      / leave-from Focus + expanded Agenda sections; roadmap Active row
- [x] Web copy: extend `coverageCopy` (+ tests) for round-trip Confirm /
      `Post to team — round trip` helpers; retire unused team-footer-only strings
      if nothing else references them
- [x] Web: restructure `DriverPicker` — Ask the team as trailing selectable chip;
      primary button branches assign vs ask; slot for Different plans link;
      remove team footer section on these surfaces
- [x] Web: wire Focus/Hero + Agenda expanded DriverPicker call sites (leave-from
      slot + labels) without forking a second stack
- [x] Tests: `DriverPicker`, `coverageCopy`, Focus/Hero and AgendaRow (or
      equivalent mount sites) updated for new chrome; run relevant `web/` tests

## Open questions

_(none blocking — leave-from one-time kept because already wired; Different
plans activation deferred to `carpool-leg-split-plans`.)_
