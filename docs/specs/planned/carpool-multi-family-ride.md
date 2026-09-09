# Spec stub: carpool-multi-family-ride

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-09  
Added: 2026-09-09 · re-rank split

Thin stub from `/spec carpool-leg-to-from` split. **Not implementable yet.**
Run `/spec carpool-multi-family-ride` to flesh out Approach, Acceptance
Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

After per-kid `CarpoolRequest` + per-leg `Ride`, a driver still cannot put
kids from **two circles** on the same active `Ride` (e.g. dad drives own kid +
a teammate TO practice). Seat math and “add to my ride” UX are missing.

## Non-goals (sketch)

- One-way legs model itself (`carpool-leg-to-from`)
- Split-plans progressive disclosure UI (`carpool-leg-split-plans`)
- Meet-at places (`carpool-meet-at`)
- Stop-order optimize (`carpool-route-optimize`)
- Expo / push

## Notes

- Depends on shipped `carpool-leg-to-from` (same-circle passengers already
  allowed on one `Ride`).
- This is the cross-circle passenger / merge path, not a second request shape.
