# Spec stub: carpool-pickup-detour

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec carpool-pickup-detour` before any code.

**Depends on:** [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`unified-ride-status-chip`](../planned/unified-ride-status-chip.md), [`weekly-list-focus-sync`](../planned/weekly-list-focus-sync.md)

## Problem

Carpool requests showed who needs a ride but not where pickup is or how far out
of the way — Accept/Decline was a guess.

## Non-goals (sketch)

- Fake/static detour numbers in production
- Full multi-stop routing UI ([`carpool-multi-stop`](carpool-multi-stop.md) stays parked)

## Notes

- `PickupLine` under every request in hero slide and list row, before Accept/Decline.
- Color by `detourMinutes`: ≤10 green ("on your way"), 11–20 amber, 20+ muted red.
- **Backend dependency:** real `detourMinutes` needs routing (home → pickup → rink) or precomputed upstream field — `/spec` must scope explicitly.
