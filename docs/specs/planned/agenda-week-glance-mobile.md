# Spec stub: agenda-week-glance-mobile

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-week-glance-mobile`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

After web ships a five-day Agenda status strip, iOS and Android have no
equivalent, so “is this day OK?” will exist only on web.

## Non-goals (sketch)

- Web rail chrome (`agenda-week-glance`)
- Month/week grid (`family-calendar-grid`)
- Multi-stop carpool card (`carpool-multi-stop`)
- Changing coverage / RSVP rules

## Notes

- Depends on shipped [`agenda-week-glance`](../active/agenda-week-glance.md).
- Native chrome OK (compact strip, sheet, or section — not a forced
  three-column layout). Copy and day-status meaning must match web.
