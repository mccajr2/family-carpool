# Spec stub: agenda-carpool-state-clarity

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-carpool-state-clarity`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Ride state copy on Calendar is thinner than the Carpool tab. Own PENDING /
ACCEPTED often chip-only on Focus; seats missing on Focus incoming ask; pickup
often missing on expanded Agenda rows. Adults have confirmed or accepted rides
without knowing who or where — every shown ride state needs decision-critical
**who / where / kids / seats**.

## Non-goals (sketch)

- Cancel / Withdraw / Pass wiring —
  [`agenda-carpool-action-parity`](../archive/agenda-carpool-action-parity.md)
- Rider initials circles —
  [`agenda-ride-rider-chips`](agenda-ride-rider-chips.md)
- Restoring full RSVP / leave-from / conflict-detail bands on Focus
- Multi-stop, meet-at, leg to/from
- Expo Agenda UI

## Notes

- Match `CarpoolSpaceRides` summary density for the **ride line** on Focus and
  expanded AgendaRow; keep Focus slim otherwise.
- Include seats on Focus incoming ask. Build on any already-shipped Focus
  who/where / “Riding with” chip work without regressing it.
