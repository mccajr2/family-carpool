# Spec stub: carpool-leg-chip-collapse

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-11  
Added: 2026-09-11 · enhancement

Thin stub from dogfood on dual leg chips. **Not implementable yet.** Run
`/spec carpool-leg-chip-collapse` after
[`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md) (or
confirm merge at `/spec`).

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** — do not grow this stub into a mega-spec.

## Problem

[`carpool-leg-to-from`](../archive/carpool-leg-to-from.md) always shows **two**
status chips (Getting there / Coming back), even when both legs are the same
round-trip ask or confirm. That preserves one-leg clarity but reads noisy for
the common case — e.g. inbound Accept shows **Getting there: Asked team** and
**Coming back: Asked team** instead of one round-trip signal. Need **clarity
when legs differ, simplicity when they match**.

## Non-goals (sketch)

- Per-leg split editor —
  [`carpool-leg-split-plans`](carpool-leg-split-plans.md)
- Default DriverPicker / Confirm chrome —
  [`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)
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
- Likely a small web-only helper change + surface tests; no OpenAPI needed.
- After [`carpool-leg-split-plans`](../active/carpool-leg-split-plans.md), mismatched
  drivers keep dual chips; matched round-trips stay one chip. Per-leg places
  remain [`carpool-meet-at`](carpool-meet-at.md).
- Open at `/spec`: exact empty/Needs-ride edge cases; whether Carpool tab
  uses the chip component or stays a single text line.
