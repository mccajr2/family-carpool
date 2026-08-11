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
- Multi-stop teammate pickups (`driver-leave-by-pickups`)

## Notes

- Depends on `event-leave-by-estimate` shipping first (leave-by = arrival target − travel − buffer).
- **Sketch defaults:** game **30 min** early, practice **15 min**, other/manual **0** — all editable per event (or per feed/type).
- Needs a rule for classifying game vs practice (title heuristics, feed metadata, or explicit type) — decide at `/spec` time.
