# Spec stub: carpool-leg-to-from

Status: planned  
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

- Pickup vs drop-off at a house (`carpool-meet-at`)
- Early/late time windows (`carpool-early-late-window`)
- Stop-order optimize (`carpool-route-optimize`)
- Garage / seat-capacity gating (`garage-retire` / parking `garage-capacity`)
- Expo / push

## Notes

- Depends on shipped `carpool-request-accept`. Prefer after `garage-retire`
  so Accept is not vehicle-gated while legs land.
- Kid subset stays on request/accept (default all attending; deselect override).
- Promoted for carpool Beta (2026-09-08) — web first.
