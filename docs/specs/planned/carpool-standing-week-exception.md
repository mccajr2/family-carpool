# Spec stub: carpool-standing-week-exception

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-24  
Added: 2026-09-24 · re-rank split

Thin stub from `/spec carpool-recurring-standing` (slice split). **Not
implementable yet.** Run `/spec carpool-standing-week-exception` after
standing (slice A) dogfoods.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

After a standing primary is in place, real life still breaks **one week**
without ending the whole arrangement: the requester’s kid is not going, or
the standing driver cannot cover that Tuesday. Canceling must not reopen a
normal team Ask. Driver bail especially needs a **distinct** Hero (and later
push) that the requester must find coverage — household or a one-off Ask —
while the standing primary remains for future weeks.

## Non-goals (sketch)

- Inventing standing Ask / Accept / materialise / End / unanswered expire
  (`carpool-recurring-standing`)
- Rotation driver pool / turn rules (`carpool-recurring-rotation`)
- Gap-fill replacement policy for rotation (`carpool-driver-gap-fill`)
- Push plumbing (`push-notifications`) — Hero state first; push consumes it
  later

## Notes

- **Depends on** `carpool-recurring-standing` (arrangementId + materialised
  weeks).
- Requester skip-one-week (not going / clear that occurrence only) keeps
  arrangement `ACTIVE`.
- Driver bail-one-week clears that week’s materialised ride; arrangement
  stays `ACTIVE`; Hero is **not** a fresh PENDING standing/one-off Ask.
- Ships **before** rotation so hole semantics exist for dogfood.
- **Web first.**
