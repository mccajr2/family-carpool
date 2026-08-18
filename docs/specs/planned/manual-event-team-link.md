# Spec stub: manual-event-team-link

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-13  
Added: 2026-08-13 · re-rank split

Thin stub from `/spec team-carpool-space-invite`. **Not implementable yet.**
Run `/spec manual-event-team-link` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

## Problem

Manual events are circle-only today. A one-off (rescheduled scrimmage, banquet)
should be attachable to a **team** (activity feed UUID) so it can participate in
that team’s carpool, or left **standalone** (family tracking only — no carpool).

## Non-goals (sketch)

- Creating carpool spaces (`team-carpool-space-invite`)
- Ride request/accept (`carpool-request-accept`)
- Turning a manual event into a feed event / writing back to iCal

## Notes

- Depends on `team-carpool-space-invite` (space exists per normalized feed URL).
- Key off the circle’s **feed UUID** (that family’s subscribe row), not the
  space id directly — the feed is how the family already names the team.
- Standalone remains the default (today’s behavior).
- **Web first** — same client-ship-order lock as `carpool-request-accept`.
