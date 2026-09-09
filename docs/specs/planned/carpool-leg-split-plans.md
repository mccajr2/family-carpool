# Spec stub: carpool-leg-split-plans

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-09  
Added: 2026-09-09 · re-rank split

Thin stub from `/spec carpool-leg-to-from` split. **Not implementable yet.**
Run `/spec carpool-leg-split-plans` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Default To / From / Round trip is enough for most asks, but some families need
**different drivers (or plans) per direction** without leaving the request
surface — e.g. “Same driver both ways?” no → Getting there / Coming back
sections. That progressive disclosure is not in the first legs PR. Same slice
owns **Accept only a subset of legs** on an inbound round-trip ask (leg picker
on Accept); `carpool-leg-to-from` Accepts all still-OPEN legs in one action.

## Non-goals (sketch)

- Request/Ride domain remodel (`carpool-leg-to-from`)
- Multi-circle passengers on one Ride (`carpool-multi-family-ride`)
- Meet-at origin/destination (`carpool-meet-at`)
- Expo / push

## Notes

- Depends on shipped `carpool-leg-to-from` (partial status readout + five
  Calendar ride-state surfaces already wired; this adds editing disclosure +
  Accept-subset-of-legs only).
- Backend already supports two per-leg `Ride`s; this slice is primarily web UX.
