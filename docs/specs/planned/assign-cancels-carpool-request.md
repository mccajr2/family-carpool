# Spec stub: assign-cancels-carpool-request

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec assign-cancels-carpool-request`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Today coverage Assign and carpool ride requests are orthogonal: Assign never
cancels an open ask. A family can Request a ride, then Assign coverage to a
parent (take the kid themselves) and leave the carpool request live — so a
teammate who accepted or is about to accept may still expect to pick that kid
up. Manual Cancel exists, but relying on it is unsafe for dogfood trust.

## Non-goals (sketch)

- Changing Pass / Accept-after-Pass —
  [`carpool-pass-reconsider`](../archive/carpool-pass-reconsider.md)
- Ride who/where/kids/seats density —
  [`agenda-carpool-state-clarity`](agenda-carpool-state-clarity.md)
- Push / nudge when coverage is still missing
- Merging coverage and carpool into one domain model on the server (prefer
  client cancel after successful assign unless `/spec` proves otherwise)

## Notes

- Smoke finding after [`agenda-carpool-action-parity`](../planned/agenda-carpool-action-parity.md)
  (PR in flight).
- Likely shape (to confirm in `/spec`): after successful Assign / Reassign /
  Confirm, if own ride kids are covered by the new coverage, call existing
  cancel (PENDING first; ACCEPTED may need stronger confirm because it
  affects the accepting circle).
- **Open before `/spec`:** PENDING only vs also ACCEPTED? Partial assign (some
  kids still need the ride)? Confirm/reassign paths too? Client-only vs
  backend coupling? Amend architecture “Coverage orthogonal” wording once
  locked.
