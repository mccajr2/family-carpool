# Spec stub: agenda-week-glance

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-week-glance`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Adults scanning the week have no compact “is this day OK?” strip. The
Calendar mock’s right rail lists five days with coverage/driver status
(“1 needs coverage”, “2 need drivers”, “All set”, “No events”). That is
not the month/week **grid** ([`family-calendar-grid`](family-calendar-grid.md)).

## Non-goals (sketch)

- Month/week calendar grid
- The mock’s **Sharks Practice — Carpool** stop list + Open in Maps
  ([`carpool-multi-stop`](carpool-multi-stop.md) — parked until pickup
  order exists)
- New backend endpoints if the loaded Agenda window can power the strip
- iOS / Android ([`agenda-week-glance-mobile`](agenda-week-glance-mobile.md))

## Notes

- Intake: Calendar light screenshot, “WEEK AT A GLANCE” only.
- Depends on shipped [`web-shell-page-frame`](../archive/web-shell-page-frame.md)
  for the Calendar right-column chrome (this slice fills it).
- Web right rail; narrow viewports stack or collapse — do not require a
  three-column dashboard (product non-goal: desktop-first UX).
- Derive from already-loaded calendar items (coverage + RSVP + existing
  carpool summary if present). Do not invent stop counts.
