# Spec stub: activity-feed-sync

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec activity-feed-sync`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Families need schedules from external RSS/Atom and iCal/`.ics` URLs without
proprietary sport APIs. Poll on a sensible interval, dedupe by feed item UID when
present, show last-synced, and attach which kids belong on each feed.

## Non-goals (sketch)

- Manual event CRUD (`manual-events`)
- Calendar UI (`family-calendar-surface`)
- Team carpool spaces (feed = calendar only)
- Vendor-specific private sport APIs

## Notes

- Depends on kids (+ Organizer to manage feeds).
- Split from former `feed-import-calendar`.
- If RSS + iCal still won’t fit one PR at `/spec`, split further by format.
