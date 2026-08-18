# Spec stub: agenda-list-chips

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-list-chips`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Kid filter and collapsed Agenda rows still use button/text chrome. The
Calendar mock uses chips for filters and states (OVERLAPS, CONFIRMED,
NOT GOING, NEEDS DRIVER) plus covering avatars and a trailing chevron.
Same filter and expand/collapse handlers — presentation only.

## Non-goals (sketch)

- New filter semantics (still All kids + per-kid, client-side)
- Changing expand bands, coverage, RSVP, or leave-by (those stay on
  expanded `AgendaRow`; Focus slim is [`agenda-focus-card-polish`](../active/agenda-focus-card-polish.md)
  / [`docs/agenda-focus-card-addendum.md`](../../agenda-focus-card-addendum.md))
- A “3 STOPS” / “N stops” tag ([`carpool-multi-stop`](carpool-multi-stop.md))
- Week-at-a-glance rail
- Destination page header type/copy ([`web-shell-page-header`](../archive/web-shell-page-header.md))
- iOS / Android (fold into [`agenda-full-page-redesign-mobile`](agenda-full-page-redesign-mobile.md))

## Notes

- Intake: Calendar light screenshot, filter chips + Rest of today / Tomorrow
  cards.
- Existing `AgendaRow` tags use `agendaItemStatusTags` (`coverageDisplay.ts`)
  for status meaning; this slice restyles to chips only — do not invent new
  states or duplicate precedence logic.
