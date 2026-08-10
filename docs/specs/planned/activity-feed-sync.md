# Spec stub: activity-feed-sync

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split  
Updated: 2026-08-09 · iCal/webcal (not RSS)

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec activity-feed-sync`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Families need schedules from external **iCal / webcal / `.ics` subscribe URLs**
(not RSS/Atom) without proprietary sport APIs. Poll on a sensible interval, dedupe
by event `UID` when present, show last-synced, and attach which kids belong on
each feed.

**v1 platforms to validate against** (same generic URL importer — no vendor APIs):

- [Crossbar](https://www.crossbar.org) — family/team calendar feed / `/ical`
- [SportsYou](https://sportsyou.com) — subscribe URL from Calendar
- [SportsEngine](https://www.sportsengine.com) — Sync Schedule → Other Calendar / iCal feed

## Non-goals (sketch)

- Manual event CRUD (`manual-events`)
- Calendar UI (`family-calendar-surface`)
- Team carpool spaces (feed = calendar only)
- Vendor-specific private sport APIs (still true — paste the public subscribe URL)
- RSS/Atom schedule feeds (`rss-atom-schedule-feeds` parking)

## Notes

- Depends on kids (+ Organizer to manage feeds).
- Split from former `feed-import-calendar`.
- Accept `webcal://` by normalizing to `https://` (or equivalent) when fetching.
- At `/spec`, confirm one PR still covers URL CRUD + poller + kid attachment; if
  platform-specific quirks blow scope, split a thin “feed URL + sync” slice from
  UI polish — do not add per-vendor modules.
