# Spec stub: conflict-detection

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec conflict-detection`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Overlapping needs for the same kid, or the same adult double-booked given current
coverage intent, must be visible (amber) — no silent auto-resolve.

## Non-goals (sketch)

- Assigning / confirming coverage (`coverage-confirm-decline`)
- Push notifications
- Auto-assign algorithms

## Notes

- Depends on `family-calendar-surface` (and coverage model may be minimal until next slice).
- Split from former `conflicts-and-coverage`.
