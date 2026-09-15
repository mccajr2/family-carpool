# Spec stub: day-block-route

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-14  
Added: 2026-09-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec day-block-route`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

A block's Route must span its **full stop sequence** (multiple pickups feeding
one or more events), not one event's stops alone. Builds on
[`ride-route-tab`](../archive/ride-route-tab.md) once
[`day-block-domain`](../active/day-block-domain.md) + [`day-block-agenda`](day-block-agenda.md)
exist.

## Non-goals (sketch)

- Inventing a new Route shell (reuse ride-route-tab)
- Stop-order **algorithm** as a separate product (shipped earlier as
  [`carpool-route-optimize`](carpool-route-optimize.md) for single-event; this
  slice extends optimize to the block sequence if still single-event-only)
- Playlist / music
- Cross-family block merging

## Notes

- **Must list [ADR-0004](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  in Context** (direction-correct pickup/drop-off, named addresses, single-stop
  multi-kid grouping apply to stop lists).
- Mockup SoT: [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
  (combined multi-stop Route section).
- **Color:** leave-by / route blocks that map to existing Hero-type route chrome
  keep the current dark Hero treatment.
- **Density:** progressive disclosure for supporting detail; keep ADR-critical
  stop labels fully visible.
- Ranked after `carpool-route-optimize` so single-event optimize ships first;
  at `/spec`, wire optimize to the block's stop list when a block is present.
- Web first.
