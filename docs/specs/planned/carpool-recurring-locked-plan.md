# Spec stub: carpool-recurring-locked-plan

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-21  
Added: 2026-09-21 · re-rank split

Thin stub from `/roadmap` (recurring carpool carve-up). **Not
implementable yet.** Run `/spec carpool-recurring-locked-plan` to flesh out
Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Families repeat the same Tuesday (etc.) pattern every week — e.g. dad always
picks kid 1 and kid 2 up at their afterschool places, drives back-to-back
practices at the same venue (6pm then 7pm), same Leaving from / Returning to.
Today each occurrence still needs fresh coverage confirm / plan setup. Adults
need a **locked standing assignment** that applies week over week until they
change it — no ritual re-confirm when nothing changed.

## Non-goals (sketch)

- Teammate Ask/Accept standing or rotation
  (`carpool-recurring-standing`, `carpool-recurring-rotation`)
- Neighborhood proximity discovery (`neighborhood-carpool`)
- Gap-fill when the locked driver can’t cover that week
  (`carpool-driver-gap-fill`)
- Inventing new drive-block merge rules (reuse existing blocks when venues
  line up)

## Notes

- **Household / circle first** — may lock coverage CONFIRMED + per-leg
  leave-from / return-to (and ride PLAN when relevant) across matching
  recurring FEED (or linked MANUAL) occurrences.
- Matching “same events week over week” (UID / series / feed+time-of-week)
  is an open `/spec` detail — do not invent a second calendar product.
- Dogfood: two kids, staggered practices same location, one adult, stable
  afterschool pickups.
- **Web first.**
