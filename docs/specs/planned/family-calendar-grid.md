# Spec stub: family-calendar-grid

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-10  
Added: 2026-08-10 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Parked (design surface)
until web carpool is dogfoodable. Promote with `/roadmap`, then `/spec family-calendar-grid`.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Agenda shows what’s next, but adults also expect an **iOS-style month/week
calendar grid** to scan the month, jump by day, and see density of activities
across kids. This is **not** the five-day status strip
([`agenda-week-glance`](../archive/agenda-week-glance.md)).

## Non-goals (sketch)

- Leave-by, conflicts, coverage, carpool
- Replacing the unified schedule data model (builds on agenda’s feed + manual
  composition)

## Notes

- Depends on `family-calendar-surface` (agenda + readable schedule API).
- Split from `family-calendar-surface` when agenda-only was locked for the first
  calendar PR.
