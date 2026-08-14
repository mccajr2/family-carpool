# Spec stub: driver-leave-by-pickups

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec driver-leave-by-pickups`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

When an accepted carpool includes picking up teammates, the driver’s leave-by
estimate should account for multi-stop pickup order — still labeled estimate,
not live traffic.

## Non-goals (sketch)

- Live turn-by-turn navigation
- Paid live traffic
- Replacing single-origin leave-by from `origins-and-leave-by`

## Notes

- Depends on `carpool-request-accept` + `origins-and-leave-by`.
- May demote to parking after slice 10 if single-origin leave-by is enough for beta.
- Parked `[carpool-meet-at](carpool-meet-at.md)` and
  `[carpool-leg-to-from](carpool-leg-to-from.md)` change what “a pickup” means
  (drop-off at the driver’s house; to-only vs from-only). Keep this slice on
  v1’s pickup-at-requester + both-legs model unless those promote first.
