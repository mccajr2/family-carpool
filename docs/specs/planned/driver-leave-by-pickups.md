# Spec stub: driver-leave-by-pickups

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Parked until
[`carpool-multi-stop`](carpool-multi-stop.md) defines pickup order — there is
nothing to route until that field exists.

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

- Depends on `carpool-request-accept` + shipped leave-by (`event-leave-by-estimate`).
- Promote only after [`carpool-multi-stop`](carpool-multi-stop.md) (ordered
  pickups + data-model field). This slice is the **estimate math**, not the
  stop-list UI.
- Parked `[carpool-meet-at](carpool-meet-at.md)` and
  `[carpool-leg-to-from](carpool-leg-to-from.md)` change what “a pickup” means
  (drop-off at the driver’s house; to-only vs from-only). Keep this slice on
  v1’s pickup-at-requester + both-legs model unless those promote first.
