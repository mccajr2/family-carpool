# Spec stub: weekly-list-focus-sync

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec weekly-list-focus-sync` before any code.

**Depends on:** [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md), [`unified-ride-status-chip`](../active/unified-ride-status-chip.md), [`hero-attention-carousel`](../planned/hero-attention-carousel.md)

## Problem

The weekly list previously showed every field expanded at once, with no visual
link to whatever the hero currently considers most urgent.

## Non-goals (sketch)

- Replacing [`AgendaWeekGlance`](../../web/src/components/AgendaWeekGlance.tsx) Context aside (different surface)
- Reordering list by priority (list stays chronological)

## Notes

- Collapsed-by-default game rows: team, opponent, date/time, rink + `StatusChip` / `CarpoolAskChip`.
- Expanded: `DriverPicker`, revert links ([`ride-revert-undo`](../planned/ride-revert-undo.md)), attendance toggle ([`attendance-manual-toggle`](../planned/attendance-manual-toggle.md)), per-request rows.
- Highlight border on row matching `getQueue(games)[0]?.game.id` — same module as hero, never re-derived locally.
