# Spec stub: unified-ride-status-chip

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec unified-ride-status-chip` before any code.

**Depends on:** [`coverage-priority-engine`](../archive/coverage-priority-engine.md)

## Problem

Ride status, carpool-driver status, and attendance were spread across an RSVP
dropdown, a flat "NEEDS COVERAGE" badge, and raw error text — none of it
distinguished "you're driving just your own kid" from "you're driving your kid
*and* carpooling others."

## Non-goals (sketch)

- Merging inbound carpool ask count into the ride status chip (separate `CarpoolAskChip`)
- Replacing Feeds-tab carpool chips outside Agenda/coverage surfaces

## Notes

- One `StatusChip` driven by `OwnRideStatus` + `attendance`: Ride needed, Waiting on {name}, Asked the team, Riding with {name}, You're driving / {name} driving, **You're driving · +{n}** (teal when `acceptedRiders` non-empty).
- `Not going` (gray) wins when `attendance === "not_going"`.
- Separate `CarpoolAskChip` for pending inbound requests (`{n} carpool ask(s)`, amber).
- Centralize label/tone vocabulary for [`hero-attention-carousel`](../planned/hero-attention-carousel.md) and [`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md).
