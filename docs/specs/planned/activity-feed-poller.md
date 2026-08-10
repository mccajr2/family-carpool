# Spec stub: activity-feed-poller

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-10  
Added: 2026-08-10 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec activity-feed-poller` to flesh out Approach, Acceptance Criteria, and
Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Subscribed feeds go stale unless someone hits Sync now. Circles need a
**background poll** on a sensible interval that reuses the same fetch/parse/UID
dedupe path, updating **last-synced** (and soft-fail error state) without
blocking the UI.

## Non-goals (sketch)

- Feed URL CRUD, kid attachment, or Sync now (`activity-feed-subscribe`)
- Manual events (`manual-events`)
- Calendar UI (`family-calendar-surface`)
- Per-vendor pollers or private sport APIs
- Push notifications when a feed changes (`push-notifications` parking)

## Notes

- Depends on `activity-feed-subscribe` (sync path + feed rows must exist).
- Split from former `activity-feed-sync`.
- Respect Nominatim-style politeness for outbound HTTP: interval, timeouts,
  soft-fail; no distributed hammering of public iCal hosts.
