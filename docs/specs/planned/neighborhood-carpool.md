# Spec stub: neighborhood-carpool

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec neighborhood-carpool`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Families who live near each other want a clearer **neighborhood carpool**
workflow (who’s nearby, standing patterns, pickups along a shared route) —
beyond one-off team request/accept. A Claude mockup exists as the intended
visual/product sketch; it is not yet checked into the repo.

## Non-goals (sketch)

- Expo / push
- Coach-administered leagues
- Live navigation or paid traffic
- Music / playlist
- Replacing team spaces (`team-carpool-space-invite`) wholesale without `/spec`

## Notes

- **Mockup SoT:** attach under `docs/ui-system/` before or during `/spec`
  (filename TBD — e.g. `neighborhood-carpool.jsx` / design export).
- Likely depends on leave-from, one-way legs, stop-order optimize, and/or
  recurring rotation — `/spec` must name the minimum shipped deps.
- Expect a **split** at `/spec` if the mockup spans discovery UI + matching +
  standing groups; keep this stub as the umbrella id until then.
- Web first.
