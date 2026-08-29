# Spec stub: auto-decline-unofferable

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec auto-decline-unofferable` before any code.

**Depends on:** [`coverage-priority-engine`](../active/coverage-priority-engine.md), [`ride-revert-undo`](../planned/ride-revert-undo.md)  
**Governs:** [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)

## Problem

A parent could accept carpool requests while their own child's ride was
unresolved — offering a ride they didn't have secured.

## Non-goals (sketch)

- Pre-action warning paragraph before "Ask the team" (deliberately cut)
- Broadening trigger to plain `"unassigned"` (must stay `"requested"` only)
- Replacing all of [`assign-cancels-carpool-request`](assign-cancels-carpool-request.md) assign-path behavior in one PR if `/spec` splits further

## Notes

- Wire `autoDeclineUnofferable` into every state-updating mutation path.
- Auto-declined requests: `autoDeclined: true`, chip copy "Declined — you needed a ride too".
- Previously auto-declined requests become reconsiderable when a confirmed driver is assigned (falls out of [`ride-revert-undo`](../planned/ride-revert-undo.md) gating).
- Supersedes [`assign-cancels-carpool-request`](assign-cancels-carpool-request.md) for the "ask team for own ride" path; assign-after-coverage coupling may still need explicit handling in `/spec`.
