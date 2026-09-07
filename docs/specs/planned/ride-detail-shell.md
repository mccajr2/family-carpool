# Spec stub: ride-detail-shell

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Added: 2026-09-06 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-detail-shell`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Once a ride is **confirmed** (household driver or teammate driving), adults need
a place to see route + playlist logistics. Home has no entry, and there is no
per-event detail screen with Route / Playlist tabs.

## Non-goals (sketch)

- Real `Ride` persistence, OSRM legs, or Spotify OAuth (later tabs)
- Changing home structure beyond `canRoute` entry affordances
- Push/SMS delivery for notify/invite (UI may stub; delivery later)

## Notes

- **Mockup SoT:** [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  — `canRoute`, `GameCard` route icon + expanded “Route & playlist for this
  ride”, `DetailScreen`, `RouteTab` / `PlaylistTab` chrome (fixture data OK).
- Depends on [`ride-detail-schedule-utils`](../active/ride-detail-schedule-utils.md).
- Gate: show entry only when ride is confirmed — never a dead-end link.
- Visual language: existing palette, dark hero cards, pill segmented control,
  shell rail — no new visual system.
