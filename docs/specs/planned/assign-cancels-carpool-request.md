# Spec stub: assign-cancels-carpool-request

Status: cancelled  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement  
Cancelled: 2026-08-28

**Superseded by** hero & coverage flow redesign:
[`auto-decline-unofferable`](auto-decline-unofferable.md) (ask-team path) and
[`ride-revert-undo`](ride-revert-undo.md) (assign/cancel lifecycle). Do not
promote or `/spec` this id.

## Problem (historical)

Today coverage Assign and carpool ride requests are orthogonal: Assign never
cancels an open ask. A family can Request a ride, then Assign coverage to a
parent and leave the carpool request live.

## Notes

- Original stub preserved for traceability only.
- Assign-after-coverage coupling may still need explicit handling in
  `/spec auto-decline-unofferable` if not fully covered by `"requested"` trigger.
