# Spec stub: carpool-meet-at

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement  
Promoted: 2026-09-08 · carpool Beta

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

- To XOR from / Request–Ride remodel (`carpool-leg-to-from`) — ship first; this slice owns meet-point logic on the placeholder fields
- Early/late windows (`carpool-early-late-window`)
- Stop-order optimize (`carpool-route-optimize`)
- Live navigation or in-app maps
- Expo / push

## Notes

- Depends on shipped `carpool-request-accept`. Pickup/drop-off **places** are circle
  named places — do not invent a second address model.
- Showing teammate house addresses is PII: consider parked
  `[carpool-least-privilege](carpool-least-privilege.md)` before this ships.
- Drop-off at the driver’s house still needs an agreed time if it is not the
  usual leave-by — that time window is `carpool-early-late-window`, not this
  slice.
- Promoted for carpool Beta (2026-09-08), ranked after one-way legs — web first.
