# Spec stub: carpool-driver-gap-fill

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-driver-gap-fill`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

On a standing rotation, the family whose turn it is to drive may not be able
to cover that week (all kids RSVP No, or the household cannot drive). The
group needs an alert and an explicit confirm of a replacement driver — not
a silent hole in the plan.

## Non-goals (sketch)

- Inventing the happy-path rotation (`carpool-recurring-rotation`)
- One-off request/accept
- Native push plumbing (consume `in-app-notifications` first)

## Notes

- **Open product rule (lock at `/spec`, not here):** when the scheduled
  family drops out, does everyone **shift** the remaining rotation, or does
  that family owe **double duty** on the next N weeks? Do not ship both.
- Promote only after `carpool-recurring-rotation` is dogfoodable and an
  in-app alert surface exists (`in-app-notifications`).
- Rescue / emergency broadcast stays a product non-goal.
