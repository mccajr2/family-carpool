# Spec stub: event-leave-by-estimate

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec event-leave-by-estimate`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Per event, adults pick (or default) a leave-from place and see an **estimated**
leave-by: routed duration (OSRM) or fallback + time-of-day multiplier + fixed
buffer — never presented as live traffic.

## Non-goals (sketch)

- Geocoding pipeline (prior: `place-geocoding`)
- Multi-stop teammate pickups (`driver-leave-by-pickups`)
- Paid live traffic; in-app turn-by-turn
- Conflict / coverage assignment

## Notes

- Depends on `named-places`, `place-geocoding`, and calendar events.
- Split from former `origins-and-leave-by`.
