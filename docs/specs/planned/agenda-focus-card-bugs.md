# Spec stub: agenda-focus-card-bugs

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-focus-card-bugs`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Two display bugs found while screenshot-smoking the shipped web Focus card
(PR #38 / `agenda-focus-hero-surface`), not new design work.

1. **Feed titles show HTML entities literally** (`Team &amp; Family Meeting`).
   React `{item.title}` does not decode entities — the stored/API string
   already contains `&amp;`. `IcalParser.unescapeText` only handles RFC 5545
   TEXT (`\,` `\;` `\\` `\n`), not HTML. Likely SportsEngine/Sharks SUMMARY
   (and maybe LOCATION) arriving HTML-encoded.
2. **Countdown ring label is uncapped.** Fill already caps at
   `RING_MAX_MINUTES = 180`; `formatMinutes(mins)` does not, so a 10-day-out
   event prints `236h 39`. Cap the **label** independently at 24h (`—` beyond
   that). Do not change the fill cap.

## Non-goals (sketch)

- Restyling the Focus card or changing selection/handlers
- Changing `RING_MAX_MINUTES` (fill stays a 3h urgency cue)
- iOS/Android Focus chrome (`agenda-focus-card-mobile`) — ring is web-only
  today; a parser-level title fix still benefits every client
- Treating a per-component `item.title` decode as the intended fix

## Notes

- One PR: backend ingest (+ tests) and web ring (+ tests). Not “web only.”
- Double-escape-at-render is almost certainly a red herring; investigate the
  ICS `SUMMARY`/`LOCATION` path first (`IcalParser` → snapshot → calendar
  GET). `FeedCalendarApiImpl` already re-unescapes LOCATION at read time for
  leftover iCal TEXT — same class of leftover encoding, not HTML.
- Parser-only fix updates stored rows on next Sync/poll (`applySnapshot`).
  Call that out; a read-time decode (mirroring LOCATION) is OK so already-
  ingested rows don’t wait. A display-layer decode is fallback only — if used,
  the PR must say so and file a real follow-up; do not ship it as the fix.
- Cover `&lt;` / `&#39;` / `&quot;` in a fixture, not just `&amp;`. Existing
  SportsEngine-like `.ics` has none.
- Automated tests required (parser entity decode + ring label cap). Manual
  smoke of the screenshot scenario is extra, not a substitute.
- Ring snippet in `AgendaFocusCard.tsx` still matches the intake; apply the
  label cap to the live logic, don’t paste blind if it has drifted.
