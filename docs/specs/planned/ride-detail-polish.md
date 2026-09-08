# Spec stub: ride-detail-polish

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Added: 2026-09-06 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-detail-polish`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Confirmed rides can still be mid-compute (geocoding / OSRM in flight), notify
can fail, and OSRM can be unreachable — leave-by must not silently show a wrong
number. The Route-only detail surface needs explicit loading and error states.

## Non-goals (sketch)

- New happy-path features beyond honest empty/error/loading chrome
- Playlist / Spotify / Apple Music work (parked — see Carpool music)
- Replacing OSRM with paid live traffic (`paid-live-traffic`)
- Building push infrastructure (`push-notifications`)

## Notes

- **Mockup SoT:** pending/empty/error copy and interaction patterns in
  [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  — keep unless `/spec` names a change (Playlist chrome may already be hidden by
  [`ride-detail-route-only`](ride-detail-route-only.md)).
- Depends on [`ride-route-tab`](../archive/ride-route-tab.md) and
  [`ride-detail-route-only`](ride-detail-route-only.md) (Playlist chrome hidden).
- Explicit “couldn’t compute drive time” when OSRM fails (do not fall back to a
  fake leave-by without labeling it).
