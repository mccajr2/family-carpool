# Spec stub: carpool-recurring-rotation

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-recurring-rotation`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Teammate families who live near each other want a standing rotation for a
recurring team event (e.g. every Tuesday practice): families take turns, and
on a given week one family drives all the kids in the group. A kid who RSVPs
**No** drops out of **that week’s** carpool only — the rotation template
stays.

## Non-goals (sketch)

- One-off request/accept (`carpool-request-accept` ships first)
- Driver-family can’t-cover replacement rules (`carpool-driver-gap-fill`)
- Native push / in-app inbox (`in-app-notifications`, `push-notifications`)
- To XOR from, meet-at, early/late windows, multi-stop
- Coach-administered schedules

## Notes

- Depends on `carpool-request-accept` + `manual-event-team-link` (team
  event to attach the rotation to) + existing RSVP.
- **Web first** — same client-ship-order lock as `carpool-request-accept`.
- Happy-path rotation only: who drives which week, occupancy from RSVP Yes.
- Gap-fill when it is that family’s turn and they cannot drive is a
  **separate** parked slice — do not invent shift vs double-duty here.
