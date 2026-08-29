# Spec stub: hero-attention-carousel

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec hero-attention-carousel` before any code.

**Depends on:** [`coverage-priority-engine`](../active/coverage-priority-engine.md), [`household-driver-assignment`](../planned/household-driver-assignment.md), [`unified-ride-status-chip`](../planned/unified-ride-status-chip.md)  
**Governs:** [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md)

## Problem

A single-card hero that only shows the top-priority item forces the parent to
resolve it before they can even see what's next.

## Non-goals (sketch)

- Gating actions on slide #1 (every slide independently actionable)
- Context aside ask inbox or multi-hero outside the carousel
- Pickup/detour line before [`carpool-pickup-detour`](../planned/carpool-pickup-detour.md) lands (may ship without; link when ready)

## Notes

- Renders `getQueue(games)` as horizontally snapping carousel — dots + arrows, one queue item per slide.
- Slide 0 tagged "Most urgent"; others "Up next."
- Empty queue → "All caught up — nothing needs you right now."
- `"ownRide"` slides → `DriverPicker`; `"request"` slides → Accept/Decline (+ pickup line when available).
- Supersedes single-hero Focus selection for the attention queue ([`agenda-focus-next-action`](../archive/agenda-focus-next-action.md) single-item rule).
