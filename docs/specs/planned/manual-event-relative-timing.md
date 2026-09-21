# Spec stub: manual-event-relative-timing

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-18  
Added: 2026-09-18 · enhancement

Thin stub from `/spec manual-event-team-link`. **Not implementable yet.**
Run `/spec manual-event-relative-timing` to flesh out Approach, Acceptance
Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Compose currently requires exact start/end instants. Families want a manual
event **anchored to another event on the same feed** (“starts 20 min after
Sharks practice ends”) and an **open-ended / no-fixed-end** flag.

## Non-goals (sketch)

- Team-link / `feedId` persistence (`manual-event-team-link`)
- Editing FEED snapshot times
- Live travel / leave-by formula changes (`event-arrival-lead-time`,
  `conflict-travel-margin`)

## Notes

- This is a **compose/scheduling** concern (same surface as
  `agenda-event-compose`), not a carpool identity slice. Same-feed anchor
  may depend on `manual-event-team-link` when the one-off is team-linked,
  but standalone relative-to-another-manual is in play too.
- **Web first.**
