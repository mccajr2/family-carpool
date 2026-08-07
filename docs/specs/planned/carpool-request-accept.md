# Spec stub: carpool-request-accept

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-request-accept`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

For an event, default one ride request covering all attending kids who still need
a ride (seats = kid count), with override to drop a kid. Explicit accept updates
available seats after family occupants + accepted riders.

## Non-goals (sketch)

- Rescue / emergency broadcast
- Heavy public marketplace board
- Multi-stop leave-by for pickups (next slice if still needed)
- In-app chat

## Notes

- Depends on `team-carpool-space-invite` + `garage-vehicles`.
- Request/accept only — explicit confirms over automation.
