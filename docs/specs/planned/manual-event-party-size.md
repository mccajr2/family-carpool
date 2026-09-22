# Spec stub: manual-event-party-size

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-18  
Added: 2026-09-18 · enhancement

Thin stub from `/spec manual-event-team-link`. **Not implementable yet.**
Run `/spec manual-event-party-size` to flesh out Approach, Acceptance
Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Dinner-type manual events need more than per-kid going/not-going. Each RSVP
should carry an **additional-seats** count (e.g. “Declan — going, +2”) so a
total headcount is available for whoever books.

## Non-goals (sketch)

- OpenTable / restaurant reservation booking (`manual-event-team-link`
  Non-goals; do not imply a hold from headcount)
- Team-link / `feedId` / carpool `eventKey` (shipped or in
  `manual-event-team-link`)
- Adults-only events (`manual-event-adults-only`)

## Notes

- Touches the same RSVP row as attendance (`YES`/`NO`/`NO_RESPONSE`); likely
  a nullable extra-seats / `partySize` field on that row + calendar
  headcount rollup.
- May introduce a **reservation-style polarity** (no explicit RSVP → assume
  NO / omit from headcount) — that is **not** the default MANUAL rule in
  ADR-0003 (default-going). Do not silently change team-link or Agenda.
- **Web first.**
