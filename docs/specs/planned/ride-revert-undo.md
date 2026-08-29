# Spec stub: ride-revert-undo

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec ride-revert-undo` before any code.

**Depends on:** [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../active/household-driver-assignment.md), [`unified-ride-status-chip`](../planned/unified-ride-status-chip.md)
**Governs:** [ADR-0002](../../decisions/ADR-0002-automatic-non-blocking-cancellation.md)

## Problem

Every resolved ride state was a dead end — no way to undo confirming yourself
as driver, cancelling a team ask, or an external teammate ride falling through.

## Non-goals (sketch)

- Confirmation dialogs before any revert (ADR-0002 rejects them)
- Optional reason/apology note on cancellation (explicitly deferred)

## Notes

- `onCantMakeIt(gameId)`: revert `ownRide` to `"unassigned"` + auto-withdraw accepted requests — one update, no dialog.
- Per-request: "Can't take them anymore" withdraws one request only.
- Revert copy uses **"drive"** language only (never "make it"): e.g. "Can't drive anymore? Reassign the ride", "No longer need a ride? Cancel this ask".
- Terminal request statuses reversible: declined → "Reconsider" (gated on `isConfirmedDriver`); withdrawn → "Undo".
