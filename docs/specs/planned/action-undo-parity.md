# Spec stub: action-undo-parity

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-08  
Added: 2026-10-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec action-undo-parity` to flesh out Approach, Acceptance Criteria, and
Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec. Expected split: un-pass in one PR, standing-primary end in
another, only if they do not share one quiet-link change.

## Problem

Parents can assign a driver, post an Ask, accept a ride, pass, lock a
week, and merge a drive block. Most of those already have a one-click
reverse. Two do not. Pass cannot be undone: a mistaken Pass leaves the
ask out of Hero, and Accept-after-Pass is accepting, not taking the Pass
back (`carpool-pass-reconsider` locked un-pass out). A standing Accept
commits the accepting family as primary, and End standing is the
requesting circle’s control — the family who accepted cannot take the
series back from the surface that offered Accept.

## Non-goals (sketch)

- One-week skip or driver bail (`carpool-standing-week-exception`)
- Confirmation dialogs (ADR-0002 stays one-click)
- Restyling the card (`calendar-card-hierarchy` owns weight and placement)
- Rotation, neighborhood, push, or an in-app inbox
- Rebuilding reverses that already exist

## Notes

- **Beta gate, rank 3.** After `agenda-card-one-language`. Depends on
  `calendar-card-hierarchy` for the quiet slot.
- Locked: [Reversible actions](../../roadmap.md) in `docs/roadmap.md`.
  Un-pass supersedes the “no un-pass” line in
  `carpool-pass-reconsider`.
- Already count as the reverse (do not rebuild): Cancel own request;
  Withdraw / Can’t take them anymore; RevertRideLink / remove coverage;
  RSVP going ↔ not going; Remove recurring; End standing Ask (requesting
  circle); drive-block split / recombine; manual event edit/remove;
  clear-legs; Reconsider on auto-decline.
- In this slice: un-pass (the ask returns to Hero for that adult, one-off
  and standing); series-level end for the accepting primary when End is
  requester-only today.
- At `/spec`, list any other write with no same-surface reverse. More than
  a handful of new links → split. Do not turn this into an invariant audit
  (`client-server-invariant-audit` is after beta, before Expo).
