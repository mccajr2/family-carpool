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
[`day-block-domain`](day-block-domain.md) + [`day-block-agenda`](day-block-agenda.md)
exist.

## Non-goals (sketch)

- Inventing a new Route shell (reuse ride-route-tab)
- Stop-order **algorithm** as a separate product — consume the reusable
  waypoint helper from
  [`carpool-route-optimize`](../active/carpool-route-optimize.md); this slice
  **assembles** the block’s full middle-stop list (household afterschool /
  leave-from places + teammate riders on that leg + shared venue timing) and
  calls the same optimize + drag/recompute pattern. Do not reimplement
  permutation / duration search.
- Playlist / music
- Cross-family block merging

## Notes

- **Must list [ADR-0004](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  in Context** (direction-correct pickup/drop-off, named addresses, single-stop
  multi-kid grouping apply to stop lists).
- **Optimizer SoT:** reusable waypoint helper is already documented under
  [`docs/architecture.md`](../../architecture.md) Leave-by → **Stop-sequence
  optimize** (and shipped via `carpool-route-optimize`). At `/spec`, put that
  heading + the leaveby helper in Context; this slice **assembles** block /
  per-leg middle stops and calls the helper — **do not** reimplement
  permutation / duration search.
- Mockup SoT: [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
  (combined multi-stop Route section).
- **Color:** leave-by / route blocks that map to existing Hero-type route chrome
  keep the current dark Hero treatment.
- **Density:** progressive disclosure for supporting detail; keep ADR-critical
  stop labels fully visible.
- Ranked after `carpool-route-optimize` so the waypoint optimizer ships first;
  at `/spec`, assemble the block stop list (TO and FROM independently from
  riders on that leg) and call the same helper — e.g. home → kid1 community
  center → kid2 school → teammate house → rink for earliest practice + buffer.
- **There / Back Route chrome:** deferred from `carpool-route-optimize` (Route
  stays TO-only until then). At `/spec`, consider tabs or dual sections so
  both legs are planable (prefer over time-only auto-switch); wire each leg’s
  stop list through the shared optimize + drag pattern.
- Web first.
