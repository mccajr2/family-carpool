# Spec stub: family-conflict-report

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-16  
Added: 2026-09-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec family-conflict-report`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

When **different kids** have overlapping events, the household must split up or
lean on carpool — but today’s Agenda only flags same-kid and adult-coverage
overlaps. Families need a **clear, lower-urgency report** (who + which events)
so the split is visible early, without a forced Hero decision.

## Non-goals (sketch)

- Forced pick / decline Hero (`player-conflict-hero`)
- Soft travel margin (`conflict-travel-margin`)
- Replacing adult coverage amber / CONFIRMED **409** (`conflict-detection`)
- Auto-assign two drivers or auto-ask the team
- Push/email alerts

## Notes

- **Reporting only** in this slice: distinct conflict type + readable Agenda
  copy (kid names + peer titles/times). No forced resolution UI.
- Do **not** overload `ADULT_COVERAGE_OVERLAP` — that stays “same adult booked
  on two events.” Family = multi-kid time clash regardless of coverage yet.
- `/spec` should lock: OpenAPI type name; whether same-venue / same-feed
  overlaps are excluded; chrome severity vs player/kid amber; Hero queue
  inclusion (default: **no** — stay off the forced-decision carousel).
