# Spec stub: drive-block-linked-manual

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-21  
Added: 2026-09-21 · enhancement

Thin stub from `/roadmap` (dogfood after `manual-event-team-link`). **Not
implementable yet.** Run `/spec drive-block-linked-manual` to flesh out
Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

A team-linked manual (e.g. SHARKS banquet / outing) sitting ~10 minutes after
a same-team FEED practice, same driver / same kid / nearby venues, is an
obvious driving-block candidate. Today `DriveBlockEnricher` and
`DriveBlockRouteResolver` only consider `source=FEED`, so the outing stays a
separate Agenda card and route even when both rows show You're driving.

## Non-goals (sketch)

- Teammate Agenda fan-out for someone else's linked manual (still Carpool-tab
  Accept only — `manual-event-team-link`)
- Standalone manuals (`feedId` null) joining FEED blocks
- Changing ADR-0004 merge rules (gap / buffer / FORCE_MERGE|SPLIT) beyond
  which item sources are eligible
- `agenda-block-api` / RN block chrome

## Notes

- **Depends on** [`manual-event-team-link`](../active/manual-event-team-link.md)
  (linked MANUAL has `feedId` + `eventKey` `CAL:MANUAL:{id}` + FEED-parity
  carpool). Do not `/spec` until that ships (or is on the same branch only if
  explicitly combining — prefer separate PR).
- Hotspots: `DriveBlockEnricher` (FEED-only filter + coverage CONFIRMED → TO),
  `DriveBlockRouteResolver` (FEED-only), `CarpoolApi.listConfirmedDrivingLegs`
  (today keyed as feed event ids — needs MANUAL + `CAL:MANUAL:{id}` plans /
  confirmed legs), leave-by venue reads for MANUAL destinations, web Agenda
  block grouping (already source-agnostic over `driveBlockLinks` once server
  emits them).
- Dogfood case that promoted this: Extra-Practice (FEED) → Aeronaut Outing
  (linked MANUAL), same SHARKS team, same Declan / same household PLAN, ~10
  min gap around the corner in Somerville.
- Same-feed filter? Prefer “same circle feed id” (or matching space) so a
  dentist after practice does not merge; confirm at `/spec`.
- **Web first.**
