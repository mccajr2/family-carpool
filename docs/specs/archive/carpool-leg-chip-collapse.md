# Spec stub: carpool-leg-chip-collapse

Status: archived  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-11  
Updated: 2026-09-11 (`/pr carpool-leg-split-plans` — shipped early with dogfood batch 2)  
Added: 2026-09-11 · enhancement

Thin stub from dogfood on dual leg chips. **Shipped early** with
[`carpool-leg-split-plans`](carpool-leg-split-plans.md) dogfood batch 2
(`collapseMatchingLegChips` in `transportPlan.ts`) — archived without a
separate `/spec` / implement pass.

## Problem

[`carpool-leg-to-from`](carpool-leg-to-from.md) always shows **two**
status chips (Getting there / Coming back), even when both legs are the same
round-trip ask or confirm. That preserves one-leg clarity but reads noisy for
the common case — e.g. inbound Accept shows **Getting there: Asked team** and
**Coming back: Asked team** instead of one round-trip signal. Need **clarity
when legs differ, simplicity when they match**.

## Non-goals (sketch)

- Per-leg split editor —
  [`carpool-leg-split-plans`](carpool-leg-split-plans.md)
- Default DriverPicker / Confirm chrome —
  [`carpool-ride-coverage-card`](carpool-ride-coverage-card.md)
- Changing domain leg persistence, Accept write paths, or four-state phases
- Expo / KMP

## Collapse rule (locked sketch)

Compare the two ordered legs’ **chip body** (phase copy + assignee identity
when relevant — same rules `rideStatusChip` already uses for labels):

| Legs | Chrome |
| ---- | ------ |
| Both present and **same** display status | **One** chip: `Round trip: {status}` — e.g. `Round trip: Asked team`, `Round trip: You're driving`, `Round trip: {Name} confirmed`, `Round trip: Waiting on {Name}` |
| Differ (phase and/or assignee) | **Two** chips: `Getting there: …` / `Coming back: …` (unchanged) |
| One-leg plan (other slot absent or still Needs ride while only one asked) | Keep **dual** (or single-leg-only) clarity — must **not** read as collapsed round-trip |

Same helper for Hero / Focus inbound Accept, Agenda collapsed chip strip,
expanded inbound rows, and Carpool ride lines (replace the ` · `-joined dual
string with the collapsed form when applicable).

## Notes

- Prerequisite: dual-chip helpers already ship in `rideStatusChip` /
  `coverageCopy` via `carpool-leg-to-from`.
- Implementation: `collapseMatchingLegChips` in `web/src/components/transportPlan.ts`
  (same PR as split plans).
- Mismatched drivers keep dual chips; matched round-trips stay one chip. Per-leg
  places remain [`carpool-meet-at`](../planned/carpool-meet-at.md).
