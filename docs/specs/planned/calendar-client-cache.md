# Spec stub: calendar-client-cache

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-12  
Added: 2026-08-12 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec calendar-client-cache`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Every login (and many Agenda visits) waits on a fresh calendar fetch. Circles’
schedules change infrequently, but the UX still feels cold-start slow. Adults
need Agenda **prepopulated immediately** from a local cache, with
**background refresh** updating to the freshest server view behind the scenes.

## Non-goals (sketch)

- Changing feed Sync now / server poller semantics (`activity-feed-poller`
  already refreshes feed snapshots on the server)
- Offline-first write queue / full offline editing
- Conflict detection rules (`conflict-detection`)
- Month grid virtualization (`family-calendar-grid`)

## Notes

- **Next up after `conflict-detection`.** Distinct from server-side feed poll —
  this is **client** persist + background re-fetch of
  `GET /api/family/circle/calendar` (and related enrichment).
- Calendars change rarely → intermittent background fetch for a “live” view;
  show cached items first, replace/merge when the refresh completes.
- `/spec` should lock: storage (per platform), TTL / refresh triggers (app
  foreground, interval, after Sync now / mutations), stale-while-revalidate UX,
  and invalidation on coverage/manual-event writes.
- Prefer one vertical PR across web + Android + iOS if the approach stays thin;
  split if storage strategies diverge into separate shippable slices.
