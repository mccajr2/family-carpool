# Spec stub: calendar-item-event-key

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-21  
Added: 2026-08-21 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec calendar-item-event-key`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Agenda joins FEED rows to carpool `listRides` events by title + `startsAt`
(+ location to break ties). That is flaky under fingerprint/`FP:` keys and
location drift, so Request/status on Calendar appears intermittently even when
the adult is a space member. Carpool already keys rides by `eventKey`
(`UID:<uid>` or fingerprint); calendar `CalendarItem` does not expose a matching
stable id.

## Non-goals (sketch)

- Rewriting coverage / RSVP / leave-by domain
- Multi-stop pickup order or Open in Maps
- Replacing heuristic join inside
  [`agenda-focus-carpool-actions`](../archive/agenda-focus-carpool-actions.md)
  before this slice ships (that PR keeps title+startsAt harden only)

## Notes

- Likely OpenAPI: nullable `uid` and/or `eventKey` on `CalendarItem` (FEED
  rows); **web** join prefers exact key over heuristics (frozen KMP not updated).
- Feeds already store nullable iCal UID on synced events — surface through
  calendar orchestrator rather than inventing a second identity.
- Dep: Agenda-primary carpool dogfood shipped (`agenda-focus-carpool-actions`);
  this is the durable fix for join reliability.
- Ranked **Upcoming** Next up after the archived carpool slice.
