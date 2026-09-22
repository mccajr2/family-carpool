# Spec stub: neighborhood-carpool

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement  
Updated: 2026-09-21 · `/roadmap` — proximity recommendations as primary AC

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec
neighborhood-carpool` to flesh out Approach, Acceptance Criteria, and Tasks
before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Families who live near each other want a **neighborhood carpool** path:
discover / recommend carpool families by **proximity** (homes, leave-from
places, shared route), then form standing patterns — beyond one-off team
request/accept and beyond “only people already in this feed space.”

## Non-goals (sketch)

- Replacing team spaces wholesale without an explicit `/spec` decision
- Expo / push
- Coach-administered leagues
- Live navigation or paid traffic
- Music / playlist
- Implementing locked household plans or team rotation engines (those are
  `carpool-recurring-locked-plan` / `standing` / `rotation`)

## Notes

- **Primary AC focus:** proximity-based **family recommendations** (who’s
  nearby / along the way). Standing group chrome and mockup polish may
  split out at `/spec` — keep this id as the first neighborhood slice
  unless the mockup forces an earlier split.
- **Mockup SoT:** attach under `docs/ui-system/` before or during `/spec`
  (filename TBD — e.g. `neighborhood-carpool.jsx` / design export).
- Likely depends on leave-from, stop-order optimize, and recurring standing
  or rotation for “then carpool together” — `/spec` must name minimum
  shipped deps.
- Web first.
