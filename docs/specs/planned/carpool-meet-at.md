# Spec stub: carpool-meet-at

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement  
Promoted: 2026-09-08 · carpool Beta  
Updated: 2026-09-11 · also owns true per-leg locations (deferred from leg-split)

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-meet-at`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Not every ride starts with the driver collecting kids at the requester’s house.
A family may need a **pickup at their place**, or they may be able to **drop
kids at a teammate’s house**. The request should say who travels to whom so the
driver can accept a plan they can actually run.

Families also need **independent places per leg** once the split editor exists
([`carpool-leg-split-plans`](../active/carpool-leg-split-plans.md) ships
drivers + shared leave-from only). Getting there vs Coming back may use
different **Picking up from** / **Dropping off at** saved places.

## Non-goals (sketch)

- Per-leg domain / four-state chips — [`carpool-leg-to-from`](../archive/carpool-leg-to-from.md)
- Default coverage card chrome — [`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)
- Split-plans **driver** editor + per-leg hero queue gaps —
  [`carpool-leg-split-plans`](../active/carpool-leg-split-plans.md)
- Early/late windows (`carpool-early-late-window`)
- Stop-order optimize (`carpool-route-optimize`)
- Live navigation or in-app maps
- Expo / push

## Notes

- **Owns** the deferred Ask-the-team sub-flow: plain pickup-at-home vs
  requester-specified radius drop-off + match-time distance vs candidate
  drivers’ homes. Until this ships, Ask the team stays undifferentiated.
- **Owns true per-leg location persistence** (OpenAPI + leg-slot places;
  independent location fields in the split editor). Deferred here from
  `/spec carpool-leg-split-plans` (2026-09-11) so driver split + queue can ship
  without a locations mega-PR. If `/spec` reveals locations + meet-at are too
  large together, **split** then — do not invent a third id preemptively.
- Pickup/drop-off **places** are circle named places — do not invent a second
  address model.
- Showing teammate house addresses is PII: consider parked
  `[carpool-least-privilege](carpool-least-privilege.md)` before this ships.
- Drop-off at the driver’s house still needs an agreed time if it is not the
  usual leave-by — that time window is `carpool-early-late-window`, not this
  slice.
- Ranked after legs + coverage-card + split-plans (2026-09-10 re-rank split) —
  web first.
