# Spec stub: carpool-leg-to-from

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-leg-to-from`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

A family often needs a ride **to** the event but not **from** it (or the reverse).
v1 `carpool-request-accept` always means both legs. Requesters should be able to
ask for to, from, or both; accepters see which legs they are covering.

## Non-goals (sketch)

- Changing v1 request/accept while it is still the next carpool product slice
- Pickup vs drop-off at a house (`carpool-meet-at`)
- Early/late time windows (`carpool-early-late-window`)
- Multi-stop leave-by (`driver-leave-by-pickups`)

## Notes

- Depends on `carpool-request-accept`.
- Kid subset stays on request/accept (default all attending; deselect override).
- Promote only after simple both-legs request/accept is dogfoodable.
