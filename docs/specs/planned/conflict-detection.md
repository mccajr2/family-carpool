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
- Merging coverage CRUD into this PR (coverage ships first)

## Notes

- **Depends on `coverage-confirm-decline`** so adult double-book uses real
  coverage assignments (not a temporary “everyone covers everyone” heuristic).
- This slice surfaces **both** same-kid time overlaps and adult double-books
  from coverage — still detection/UI only (amber; no auto-resolve).
- Also depends on `family-calendar-surface` (Agenda).
- Split from former `conflicts-and-coverage`; kept as a separate PR after
  coverage (do not recombine into one mega-spec).
