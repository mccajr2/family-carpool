# Spec stub: ui-palette-refresh

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-10  
Added: 2026-08-10 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ui-palette-refresh`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The first-pass teal/slate palette in `cross-platform-ui-system` is provisional and
reads generic. Adults should get a more distinctive, brand-led color system once
token plumbing exists — without rebuilding components.

## Non-goals (sketch)

- Redesigning spacing, type scale, or component parity (roles stay; hex/chroma change)
- Restyling Calendar / Family / Carpool in this slice (still
  `ui-system-destination-adoption`)
- OpenAPI / backend changes

## Notes

- Depends on shipped [`cross-platform-ui-system`](../archive/cross-platform-ui-system.md)
  (`design-tokens/tokens.json` + generator).
- **Sequence after** [`calendar-ux-flow`](../archive/calendar-ux-flow.md) and
  [`ui-system-destination-adoption`](ui-system-destination-adoption.md)
  (or the first destination-adoption slice): painting brand hex only on More
  is low PoC value; refresh once Calendar/Family/Carpool also consume tokens.
- Must re-run light/dark screenshots + WCAG AA for every surface then on tokens
  (More plus any adopted destinations).
- Palette remains expected to churn until locked in this `/spec`.
