# Spec stub: agenda-leave-by-async

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-13  
Added: 2026-08-13 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-leave-by-async`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Calendar `GET` blocks the schedule on per-row leave-by (Nominatim + OSRM). A
new client waits on travel estimates before any Agenda rows appear, even though
events are already in Postgres. Adults need the **schedule immediately**;
leave-by is a progressive enhancement. Enrich **near-term** items before later
days.

## Non-goals (sketch)

- Changing leave-by math, origin order, or OSRM vs fallback
- Persisting OSRM durations / materializing leave-by at feed-poll time
- `ETag` / `304` (`calendar-conditional-get`)
- Offline write queue
- Shrinking the stored event window as a product change (events are cheap; the
  lag is enrichment)

## Notes

- **Depends on** shipped `calendar-client-cache` (paint events from cache /
  cheap list; fill leave-by after).
- `/spec` should lock: list payload without blocking on leave-by (null /
  pending vs separate batch endpoint); client fill-in UX; near-term-first
  order; OpenAPI + web/Android/iOS together.
- Prefer one vertical PR. If list-without-leave-by and near-term paging both
  grow, split — do not combine with `calendar-conditional-get`.
