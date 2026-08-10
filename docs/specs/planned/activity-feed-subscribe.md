# Spec stub: activity-feed-subscribe

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split  
Updated: 2026-08-10 · re-rank split (from activity-feed-sync)

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec activity-feed-subscribe` to flesh out Approach, Acceptance Criteria, and
Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Families need schedules from external **iCal / webcal / `.ics` subscribe URLs**
(not RSS/Atom) without proprietary sport APIs. Organizers add a feed URL, attach
which kids belong on it, run **Sync now**, and see **last-synced** (and soft-fail
errors). Dedupe by event `UID` when present.

**v1 platforms to validate against** (same generic URL importer — no vendor APIs):

- [Crossbar](https://www.crossbar.org) — family/team calendar feed / `/ical`
- [SportsYou](https://sportsyou.com) — subscribe URL from Calendar
- [SportsEngine](https://www.sportsengine.com) — Sync Schedule → Other Calendar / iCal feed

## Non-goals (sketch)

- Background / interval polling (`activity-feed-poller`)
- Manual event CRUD (`manual-events`)
- Calendar UI (`family-calendar-surface`)
- Team carpool spaces (feed = calendar only)
- Vendor-specific private sport APIs (paste the public subscribe URL)
- RSS/Atom schedule feeds (`rss-atom-schedule-feeds` parking)

## Notes

- Depends on kids (+ Organizer to manage feeds).
- Split from `activity-feed-sync` / former `feed-import-calendar`.
- Accept `webcal://` by normalizing to `https://` (or equivalent) when fetching.
- Ships manage-feeds UI on web + Android + iOS; no calendar grid.
- Do not add per-vendor modules — one generic importer.
