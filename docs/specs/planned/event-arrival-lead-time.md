# Spec stub: event-arrival-lead-time

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-11  
Added: 2026-08-11 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec event-arrival-lead-time`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

## Problem

Leave-by today aims at event `startsAt`. Games usually want adults on site
earlier than practices; other one-offs are often “on time is fine.” Adults need
**editable arrival lead times** with sensible defaults by activity kind.

## Non-goals (sketch)

- Replacing leave-by routing math (`event-leave-by-estimate`)
- Multi-stop teammate pickups (absorbed by
  [`ride-route-tab`](../archive/ride-route-tab.md))

## Notes

- Depends on `event-leave-by-estimate` shipping first (leave-by = arrival target − travel − buffer).
- **Route interim lock** ([`ride-route-tab`](../archive/ride-route-tab.md)): game
  **45** / practice **20** / other **0** (not editable). This slice should make
  lead times editable and reconcile **Agenda** single-origin leave-by + Route
  `bufferMinutes` to one model (defaults may still change at `/spec` time —
  do not silently diverge from the Route lock without an explicit decision).
- Needs a rule for classifying game vs practice (title heuristics, feed metadata,
  or explicit type) — decide at `/spec` time; Route already uses a title
  `\bpractice\b` heuristic.
