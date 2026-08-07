# Spec stub: place-geocoding

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec place-geocoding`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Named places and event venues need coordinates for distance and leave-by.
Geocode via Nominatim (OSM), cache results, and use a respectful User-Agent.

## Non-goals (sketch)

- Leave-by / routing math (later: `event-leave-by-estimate`)
- In-app map tiles or turn-by-turn
- Paid geocoders

## Notes

- Depends on `named-places`.
- Split from former `origins-and-leave-by`.
