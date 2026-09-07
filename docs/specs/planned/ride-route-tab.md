# Spec stub: ride-route-tab

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Added: 2026-09-06 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-route-tab`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

A confirmed ride has no stop-by-stop logistics: leave-by (with pickup legs), map
preview, ordered stops, Start navigation, or “notify ready-by” per pickup.
Agenda leave-by is still single-origin; accepted teammate pickups are not in the
driver’s schedule.

## Non-goals (sketch)

- In-app turn-by-turn (use Google Maps universal deep link only)
- Google Directions API as primary routing (OSRM first; free-tier constraint)
- Spotify / playlist tab data (`ride-playlist-tab`)
- Loading / OSRM-unreachable polish beyond a minimal honest state
  (`ride-detail-polish`)

## Notes

- **Mockup SoT:** `RouteTab`, `RouteMap`, `StopRow`, `NotifyAction` in
  [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx).
- **Absorbs / supersedes:** `carpool-multi-stop`, `driver-leave-by-pickups`,
  `maps-deep-links`.
- Reuse existing leaveby OSRM + geocode patterns; extend to multi-stop
  `legMinutes` + ordered `stops` (home → pickups → destination).
- Maps Embed API optional (key → embed; no key → mockup placeholder chip row).
- **Open at `/spec`:** recompute stops/legs on each visit vs cache-on-accept;
  `bufferMinutes` — mockup 45 game / 15 practice vs
  [`event-arrival-lead-time`](event-arrival-lead-time.md) sketch (30/15/0).
- Notify ready-by: call-site + channel-agnostic send; real push may soft-fail
  until [`push-notifications`](push-notifications.md).
