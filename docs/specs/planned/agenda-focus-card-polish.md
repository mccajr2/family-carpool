# Spec stub: agenda-focus-card-polish

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-focus-card-polish`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The shipped web Focus card is denser than the Calendar mock: the countdown
ring shares the title row instead of sitting isolated and larger; covering
is not under the ring; overlap reads as body copy rather than a chip; hero
type is less bold. Same selection logic and handlers — chrome only.

## Non-goals (sketch)

- Changing `selectFocusItem`, coverage / RSVP / leave-by handlers, or ring
  unit rules (`agenda-focus-card-bugs`)
- Changing `RING_MAX_MINUTES` fill cap
- iOS / Android (`agenda-focus-card-mobile` ports this polish)
- Week-at-a-glance or carpool right rail
- “3 STOPS” (needs [`carpool-multi-stop`](carpool-multi-stop.md))
- Destination page header type/copy ([`web-shell-page-header`](../archive/web-shell-page-header.md))

## Notes

- Intake: Calendar light screenshot, Focus card (“Hang with Arthur”, 72 MIN,
  Covering: Jay, Overlaps chip, Assign coverage + Edit).
- Do not reconstruct `agendaFocusSelection.ts` / `coverageDisplay.ts`.
