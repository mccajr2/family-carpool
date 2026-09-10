# Spec stub: garage-capacity

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Added: 2026-09-10 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Parked until the
carpool Beta cluster dogfoods without capacity. Run `/spec garage-capacity`
only after promoting from parking.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

After garage was retired from the product, households still eventually need
**vehicles + seating capacity** so Accept / multi-family rides can respect
real car size. That modeling must not return until request/accept,
leg plans, and multi-family dogfood are solid without it.

## Non-goals (sketch)

- Shipping capacity as a gate on Accept before dogfood
- Kid vs adult vs booster seat kinds (separate `garage-seat-kinds` if revived)
- Expo / push

## Notes

- Depends on `garage-retire` having removed premature garage coupling.
- Supersedes the old “garage is required for Accept” path from
  `garage-vehicles`.
- Promote only when dogfood shows missing capacity is blocking — not by
  default with the next carpool slice.
