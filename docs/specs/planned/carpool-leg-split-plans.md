# Spec stub: carpool-leg-split-plans

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Added: 2026-09-10 · re-rank split

Thin stub from `/roadmap` split of Ride Coverage Card goals. **Not
implementable yet.** Run `/spec carpool-leg-split-plans` after
`carpool-ride-coverage-card` (or confirm merge at `/spec`).

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** — do not grow this stub into a mega-spec.

## Problem

Round-trip is the default, but families often need **different drivers or
locations** for Getting there vs Coming back. That complexity must stay one tap
away — never inline by default — via **“Different plans for each leg.”**

## Non-goals (sketch)

- Default collapsed card chrome — [`carpool-ride-coverage-card`](../archive/carpool-ride-coverage-card.md)
- Matching-leg chip collapse (plain status body when TO/FROM match) —
  [`carpool-leg-chip-collapse`](../active/carpool-leg-chip-collapse.md)
- Ask-the-team radius / meet-at sub-flow — [`carpool-meet-at`](carpool-meet-at.md)
- Domain four-state legs + combined cancel foundation —
  [`carpool-leg-to-from`](../archive/carpool-leg-to-from.md) (prerequisite)

## Notes

- Replace default form with **Getting there** / **Coming back** sections;
  each has independent driver chips + one location field (**Picking up from** /
  **Dropping off at**); same saved-places combobox behavior as default.
- **Back to simple view** returns to collapsed form.
- Bottom button: **Save ride plan** (applies both legs at once).
- Combined cancel when same driver both legs is owned by
  `carpool-leg-to-from` (driver identity only; per-leg locations preserved).
- Still one shared plan for all going kids; per-kid progressive disclosure is
  [`carpool-kid-split-plans`](carpool-kid-split-plans.md).
- Web first.
- **Hero / coverage queue (must address at `/spec`):** today `getQueue` /
  `isOwnRideGap` key off rollup `ownRide` (household coverage + whole-request
  PENDING/ACCEPTED), **not** per-leg `NEEDS_RIDE`. Mixed plans (e.g. you cover
  TO, ask team on FROM) mean a cancelled/withdrawn teammate leg can leave a
  real gap that never re-enters the hero carousel while coverage still looks
  “covered.” This id owns teaching the queue (and Focus CTAs) about **per-leg
  gaps** when legs diverge — out of scope for
  [`carpool-leg-chip-collapse`](../active/carpool-leg-chip-collapse.md)
  (display-only).
