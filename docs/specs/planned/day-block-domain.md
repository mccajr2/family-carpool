# Spec stub: day-block-domain

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-14  
Added: 2026-09-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec day-block-domain`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Hero and Agenda are **per event** (one `CalendarItem` → one card / Route). That
breaks down when one continuous drive serves multiple events (e.g. one leave-
home run feeding back-to-back practices). We need a **driving block** —
CalendarItems sharing a driver (adult), contiguous time window, and usually a
destination — as a display/routing grouping over existing RideRequest /
per-leg / coverage data. This slice owns the domain + API only; no UI yet.

## Non-goals (sketch)

- Agenda/Focus card UI (`day-block-agenda`)
- Route tab multi-event stop sequence (`day-block-route`)
- Stop-order optimize (`carpool-route-optimize` — stays single-event until
  blocks exist; do not absorb here)
- Any change to per-event RideRequest / coverage semantics
- Cross-family block merging (one household's own driving only)

## Notes

- Depends on true per-leg places from [`carpool-leg-places`](../archive/carpool-leg-places.md)
  — more valuable once legs aren't stuck at requester house.
- After [`carpool-route-optimize`](carpool-route-optimize.md) so
  optimize ships for today's single-event Route without a redo; block-wide
  optimize is deferred to `/spec day-block-route` (or a later re-scope).
- **Must list [ADR-0004](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  in Context** when fleshed — domain shapes that feed cards/Route must not
  fight the nine rules.
- Mockup SoT (grouping only): [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
- Web / OpenAPI first; no Expo.
