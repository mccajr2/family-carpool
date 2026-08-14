# Spec stub: carpool-early-late-window

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-early-late-window`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Sometimes the ride is not “usual arrival.” Example: a family needs to **drop a
kid two hours early** so they can take another kid somewhere else — is there a
driver who can take that extra kid on the **front** of the event? Same pattern
after the event (late pickup / early leave). The requester names the window;
the accepting driver **approves that time**, not only the seats.

## Non-goals (sketch)

- Changing v1 request/accept (event start/end as the only times)
- Coverage assignment for the other kid’s overlapping event
  (`coverage-confirm-decline` already exists; this slice is the teammate ride)
- Live traffic or turn-by-turn
- Rescue / last-minute broadcast

## Notes

- Depends on `carpool-request-accept`. Often pairs with
  `[carpool-meet-at](carpool-meet-at.md)` (drop-off at a teammate house) but
  keep them separate PRs: place vs clock.
- Same on the **back** of the event (stay late / leave early).
- Driver approval is explicit — do not auto-match on time.
- Leave-by math for an early window may later touch
  `driver-leave-by-pickups`; do not fold routing into this slice.
