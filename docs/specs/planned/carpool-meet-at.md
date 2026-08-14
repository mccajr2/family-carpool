# Spec stub: carpool-meet-at

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-meet-at`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Not every ride starts with the driver collecting kids at the requester’s house.
A family may need a **pickup at their place**, or they may be able to **drop
kids at a teammate’s house**. The request should say who travels to whom so the
driver can accept a plan they can actually run.

## Non-goals (sketch)

- Changing v1 request/accept (pickup-at-requester implied)
- To XOR from (`carpool-leg-to-from`)
- Early/late windows (`carpool-early-late-window`)
- Live navigation or in-app maps

## Notes

- Depends on `carpool-request-accept`. Pickup/drop-off **places** are circle
  named places — do not invent a second address model.
- Showing teammate house addresses is PII: consider parked
  `[carpool-least-privilege](carpool-least-privilege.md)` before this ships.
- Drop-off at the driver’s house still needs an agreed time if it is not the
  usual leave-by — that time window is `carpool-early-late-window`, not this
  slice.
