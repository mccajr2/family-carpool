# Spec stub: carpool-meet-at

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement  
Promoted: 2026-09-08 · carpool Beta  
Updated: 2026-09-14 · `/spec` split — Ask-team sub-flow only; places → `carpool-leg-places`

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-meet-at`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Not every team ask starts with the driver collecting kids at the requester’s
house. A family may need a **pickup at their place**, or they may be able to
**drop kids at a teammate’s house**. Ask the team should say who travels to
whom so the driver can accept a plan they can actually run. Until this ships,
Ask the team stays undifferentiated (plain post).

## Non-goals (sketch)

- True per-leg place persistence / editors — Done target
  [`carpool-leg-places`](../archive/carpool-leg-places.md) (prerequisite)
- Per-leg drivers / split / kid-split chrome — already shipped
- Early/late windows (`carpool-early-late-window`)
- Stop-order optimize (`carpool-route-optimize`)
- Live navigation or in-app maps
- Expo / push

## Notes

- **Owns** the Ask-the-team meet-at sub-flow only: plain pickup-at-home vs
  requester-specified radius drop-off + match-time distance vs candidate
  drivers’ homes.
- Depends on [`carpool-leg-places`](../archive/carpool-leg-places.md) so TO/FROM
  already carry family-side places (named place / one-time / default).
- Pickup/drop-off **places** stay circle named places — do not invent a second
  address model.
- Showing teammate house addresses is PII: consider parked
  [`carpool-least-privilege`](carpool-least-privilege.md) before or with this
  ship.
- Drop-off at the driver’s house still needs an agreed time if it is not the
  usual leave-by — that time window is `carpool-early-late-window`, not this
  slice.
- Web first.
