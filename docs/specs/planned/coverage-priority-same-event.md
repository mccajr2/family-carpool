# Spec stub: coverage-priority-same-event

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec coverage-priority-same-event`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

ADR-0001 ranks **all** own-child coverage gaps ahead of **all** pending carpool
asks. That pushes a teammate’s ask for the practice you just covered behind your
own kid’s gap on a later event — even though finishing the same-event carpool
ask is the natural next decision. Priority should stay family-first, but
**same-event** carpool requests should follow immediately after that event’s
own coverage is handled.

## Non-goals (sketch)

- Manual pin/reorder of the attention queue
- Changing Pass / Accept / Assign semantics
- Push or in-app inbox (`push-notifications`, `in-app-notifications`)
- New ride request shapes (`carpool-leg-to-from`, etc.)

## Notes

- Amends [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md); update
  the ADR in the same PR as the `getQueue` change.
- Depends on shipped [`coverage-priority-engine`](../archive/coverage-priority-engine.md)
  / `getQueue`.
- Sketch rule: for event E, own gaps on E outrank carpool asks on E; once own
  coverage for E is resolved (assigned / riding / out of play), carpool asks on
  E outrank own gaps on later events F. Exact “resolved” predicates at `/spec`.
- Web first; no Expo.
