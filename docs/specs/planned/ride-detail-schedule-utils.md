# Spec stub: ride-detail-schedule-utils

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Added: 2026-09-06 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-detail-schedule-utils`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The approved ride Route/Playlist mockup embeds pure time-math, track-merge, and
maps URL helpers that every later slice needs. Extract them first so schedule
and Spotify merge logic are unit-tested without UI risk.

## Non-goals (sketch)

- Detail screen UI or Agenda entry points (`ride-detail-shell`)
- OSRM / geocoding / Spotify API calls
- Persist `Ride` or playlist records

## Notes

- **Mockup SoT:** [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  — extract `toMinutes` / `toTime` / `computeSchedule`, `mergeTracks`,
  `navigationUrl` / `embedUrl` (and small helpers they need).
- Precedent: foundation module first, like `coverage-priority-engine`.
- Downstream: `ride-detail-shell` → `ride-route-tab` → `ride-playlist-tab`.
