# Spec: carpool-leg-chip-collapse

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-11  
Updated: 2026-09-11 (`/spec` — promote; drop Round trip prefix)  
Added: 2026-09-11 · enhancement  
Branch: `carpool-leg-chip-collapse`

## Problem

[`carpool-leg-to-from`](../archive/carpool-leg-to-from.md) always shows **two**
status chips (`Getting there: …` / `Coming back: …`), even when both legs share
the same plan — the common case (one parent covering their kid both ways, or a
round-trip team ask). Dual prefixes add noise for something the reader can
infer. Families need **plain status when both ways match**, and **leg
qualifiers only when legs differ or only one leg is in play**.

## Non-goals

- Per-leg split editor —
  [`carpool-leg-split-plans`](../planned/carpool-leg-split-plans.md)
- Per-kid progressive split —
  [`carpool-kid-split-plans`](../planned/carpool-kid-split-plans.md)
- Default DriverPicker / Confirm chrome —
  [`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)
- Changing domain leg persistence, Accept write paths, four-state phases, or
  combined cancel
- Adding a `Round trip:` (or similar) prefix on collapsed chips — **locked out**
- OpenAPI / backend changes
- Expo / KMP
- Converting Carpool tab leg text lines into chip components (keep the text
  line; feed it the same collapsed labels)
- Changing when household coverage chrome suppresses blank `NEEDS_RIDE` legs
  (`transportLegsForItem` / coverage chip ownership)
- Hero / `getQueue` per-leg gap awareness when mixed plans leave one leg
  `NEEDS_RIDE` — deferred to
  [`carpool-leg-split-plans`](../planned/carpool-leg-split-plans.md)

## Approach

**Web-only** change in the shared leg-chip helpers (`rideStatusChip` +
`coverageCopy` as needed). Compare ordered TO/FROM **display status bodies**
(`legPhaseStatusLabel` — phase copy + assignee identity rules already used
today). No contract or backend work.

| Legs | Chrome |
| ---- | ------ |
| Both present and **same** display status body | **One** chip / label: the body only — e.g. `Needs ride`, `Asked team`, `You're driving`, `{Name} confirmed`, `Waiting on {Name}` — **no** `Getting there` / `Coming back` / `Round trip` prefix |
| Differ (phase and/or assignee → different body) | **Two** chips: `Getting there: …` / `Coming back: …` (unchanged) |
| Only one leg slot present (true single-leg plan) | **One** prefixed chip for that leg (`Getting there: …` or `Coming back: …`) — qualifier required |
| Inbound / clarity cases where one asked leg sits beside `Needs ride` on the other | Keep **dual** prefixed chips (bodies differ → not collapsed) |

Same helper output for Hero / Focus inbound Accept, Agenda collapsed chip
strip, expanded inbound rows, and Carpool ride lines (replace the ` · `-joined
dual string with the single body when collapsed).

## Context

Allowlist for `/implement`:

- Archived decision to reuse: [`carpool-leg-to-from`](../archive/carpool-leg-to-from.md)
  → Web (minimal) dual-chip surfaces + inbound one-leg clarity
- Source: `web/src/components/rideStatusChip.ts` (`rideLegStatusChips`,
  `inboundAskLegChips`, `agendaOwnRideLegChips`, `transportLegsForItem`,
  `legPhaseStatusLabel`)
- Source: `web/src/components/coverageCopy.ts` (`legStatusChipLabel`,
  `LEG_*` constants)
- Call sites: `AgendaFocusCard.tsx`, `AgendaRow.tsx`, `HeroAttentionSlide.tsx`,
  `AgendaInboundRequestRow.tsx`, `CarpoolSpaceRides.tsx`
- Tests: `rideStatusChip.test.ts`, `coverageCopy.test.ts`, plus surface tests
  that assert dual `Getting there` / `Coming back` for matching round-trips
  (`AgendaFocusCard.test.tsx`, `AgendaRow.test.tsx`,
  `HeroAttentionCarousel.test.tsx`, `AgendaInboundRequestRow.test.tsx`,
  `CarpoolSpaceRides.test.tsx`)

## Acceptance criteria

- [ ] When both TO and FROM legs are present and `legPhaseStatusLabel` matches,
      surfaces show **exactly one** ride-status chip/label whose text is that
      body only (examples: `Asked team`, `You're driving`,
      `House B confirmed`, `Needs ride`) — not `Round trip: …` and not
      `Getting there: …` / `Coming back: …`.
- [ ] When the two bodies differ (including TO asked + FROM `Needs ride`, or
      different assignees/phases), surfaces still show **two** prefixed chips
      `Getting there: …` and `Coming back: …`.
- [ ] True single-leg plans (only TO or only FROM in the slots) show **one**
      prefixed chip for that kind — never an unprefixed body that could be
      read as both ways.
- [ ] Hero / Focus inbound Accept, Agenda collapsed + expanded inbound rows,
      and Carpool own/inbound ride lines all use the same collapse rule (Carpool
      may stay a single text line; matching → one body string, differing →
      ` · `-joined prefixed labels as today).
- [ ] Existing blank-leg suppression for household coverage (no own request +
      both `NEEDS_RIDE`) is unchanged — coverage chrome still owns that state.
- [ ] No OpenAPI / backend changes in this PR.
- [ ] Unit tests cover collapse / differ / single-leg; surface tests that
      previously expected dual matching chips are updated and would fail if
      collapse were reverted.

## Tasks

- [ ] Web: Add collapse in `rideLegStatusChips` (or a thin shared wrapper used
      by `inboundAskLegChips` / Agenda paths) — same body → one unprefixed
      descriptor; else keep prefixed dual / single-leg prefixed behavior.
- [ ] Web: Confirm CarpoolSpaceRides text lines consume the helper output
      (matching → single body; no separate join logic that re-prefixes).
- [ ] Tests: Extend `rideStatusChip.test.ts` for match / mismatch / single-leg;
      update Focus, Agenda row, Hero, inbound row, and CarpoolSpaceRides
      assertions that currently expect dual matching chips.
- [ ] Tests: Run the affected Vitest suites from `web/` and report results.

## Open questions

None — Needs-ride matching collapses to plain `Needs ride`; no Round trip
prefix (product lock from `/spec` discussion).
