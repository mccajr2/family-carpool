# Spec stub: carpool-recurring-standing

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-21  
Added: 2026-09-21 · re-rank split

Thin stub from `/roadmap` (recurring carpool carve-up). **Not
implementable yet.** Run `/spec carpool-recurring-standing` to flesh out
Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

For a recurring team event, the **same** teammate carpool arrangement should
repeat week over week (same driver family, same riders / places) without
re-posting Ask the team and re-Accept every Tuesday. Unlike rotation, there
is no turn-taking — one standing pattern until someone opts out or edits it.

## Non-goals (sketch)

- Household-only locked multi-event plans
  (`carpool-recurring-locked-plan`)
- Fair turn-taking across 2+ driver families
  (`carpool-recurring-rotation`)
- Neighborhood proximity recommendations (`neighborhood-carpool`)
- Driver can’t-cover replacement (`carpool-driver-gap-fill`)

## Notes

- Depends on team space + request/accept (and feed/team-linked event
  identity). RSVP No for a kid drops that week only; template stays.
- Prefer “apply standing template to next occurrence” over cloning one-off
  rides by hand — exact persistence shape at `/spec`.
- Ships **before** rotation so dogfood can lock a fixed driver family
  without building the full rotation engine.
- **Web first.**
