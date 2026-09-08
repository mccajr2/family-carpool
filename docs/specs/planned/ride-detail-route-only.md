# Spec stub: ride-detail-route-only

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-detail-route-only`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Confirmed-ride detail still shows Route / Playlist tabs and live Spotify Playlist
UI, but Spotify developer/Premium constraints make Playlist unsuitable for
dogfood. Adults need a Route-only surface so the shipped Spotify path can stay
dormant without blocking carpool route use.

## Non-goals (sketch)

- Deleting Spotify backend/OAuth/playlist code (keep dormant for later reuse)
- Building Apple Music or a provider abstraction (`music-provider-model`+)
- Route loading/error polish beyond hiding the tab chrome (`ride-detail-polish`)
- Changing OSRM / multi-stop Route behavior

## Notes

- One PR: hide Playlist tab (and tab chrome if only Route remains); show Route
  content only.
- Preserve Agenda `canRoute` entry and Route tab behavior from
  [`ride-route-tab`](../archive/ride-route-tab.md).
- Product lock: Locked decisions → Carpool music in `docs/roadmap.md`.
