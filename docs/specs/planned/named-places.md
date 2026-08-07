# Spec stub: named-places

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec named-places`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Leave-by and coverage need named origins (Mom’s house, Dad’s house, Grandma’s,
School) — not a single address for the whole circle. Adults manage places shared
in the circle context.

## Non-goals (sketch)

- Routing / leave-by calculation (later: `origins-and-leave-by`)
- Live maps or turn-by-turn
- Geocoding hard requirement beyond storing address text if deferred to leave-by slice

## Notes

- Depends on `family-circle-and-kids` (and ideally invites so multi-adult can use places).
- Geocode cache / Nominatim may land here or in leave-by — decide in `/spec`.
