# Spec stub: carpool-recurring-rotation

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement  
Updated: 2026-09-21 · `/roadmap` carve-up — subset driver pool; after standing

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec
carpool-recurring-rotation` to flesh out Approach, Acceptance Criteria, and
Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Two or more teammate families want a **standing rotation** for a recurring
same-day team event (e.g. every Tuesday practice): families take turns
driving. A kid who RSVPs **No** drops out of **that week’s** carpool only —
the rotation template stays. Not every space member must drive: the **driver
pool can be a subset** of participating families (riders may include families
who never take a turn).

## Non-goals (sketch)

- Fixed same-driver standing carpool without turns
  (`carpool-recurring-standing`)
- Household locked leave-from / coverage without teammates
  (`carpool-recurring-locked-plan`)
- Driver-family can’t-cover replacement rules (`carpool-driver-gap-fill`)
- Native push / in-app inbox (`in-app-notifications`, `push-notifications`)
- Coach-administered schedules
- Neighborhood proximity discovery (`neighborhood-carpool`)

## Notes

- Depends on `carpool-request-accept` + team-linked / FEED event identity +
  existing RSVP. Prefer after `carpool-recurring-standing` so fixed patterns
  ship first.
- Happy-path rotation: who drives which week; occupancy from RSVP Yes;
  **explicit driver-pool membership** (subset) at setup.
- Gap-fill when it is that family’s turn and they cannot drive stays
  parking — do not invent shift vs double-duty here.
- **Web first.**
