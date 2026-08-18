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
- To XOR from (only one leg) — parked `[carpool-leg-to-from](carpool-leg-to-from.md)`
- Pickup vs drop-off at a teammate house — parked `[carpool-meet-at](carpool-meet-at.md)`
- Early/late time windows the driver must approve — parked
  `[carpool-early-late-window](carpool-early-late-window.md)`

## Notes

- Depends on `team-carpool-space-invite` + `garage-vehicles`.
- **Web first** — Android/iOS is parked
  [`carpool-request-accept-mobile`](carpool-request-accept-mobile.md).
- Request/accept only — explicit confirms over automation.
- v1 is **both legs** (to and from) and **pickup at the requester’s house**.
- One-or-more kids is this slice (default all attending; deselect override) —
  do not reopen that in the parked richer-request items.
- Before exposing teammate pickup addresses, consider parked
  `[carpool-least-privilege](carpool-least-privilege.md)`.
- Focus-card ride accept/decline ranking is **not** this slice — Upcoming
  [`agenda-focus-carpool-actions`](agenda-focus-carpool-actions.md) after this
  ships.
- Standing Tuesday-style rotations are **not** this slice —
  `[carpool-recurring-rotation](carpool-recurring-rotation.md)` after this
  and `[manual-event-team-link](manual-event-team-link.md)`.
