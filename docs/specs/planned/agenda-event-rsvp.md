# Spec stub: agenda-event-rsvp

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-13  
Added: 2026-08-13 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-event-rsvp`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Agenda treats every event as something the circle must cover. Adults need a
**simple RSVP** so they can mark events they are not staffing. Those rows stay
on the list (title / when / who) but are **deemphasized**, and coverage,
leave-by, and other dependent controls are **removed** so the list stays
focused on events that still need attention. The same RSVP record is the
foundation for later carpool seat counts and team rollups.

## Non-goals (sketch)

- Carpool request/accept, team spaces, or team-wide rollup UI
  (`team-carpool-space-invite`, `carpool-request-accept`)
- Changing coverage assign/confirm rules for events that still need cover
- Hiding or deleting the event from the schedule
- Coach/league RSVP or vendor-app sync

## Notes

- `/spec` should lock: per-adult vs circle-visible “skip cover”; states (e.g.
  going / not going / unset); which chrome is stripped on skip; OpenAPI +
  web/Android/iOS together.
- Prefer one vertical PR. Do not pull carpool consumption into this slice.
