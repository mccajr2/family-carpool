# Spec stub: block-route-origin

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-17  
Added: 2026-09-17 · enhancement  
Blocked by: [`day-block-route`](../archive/day-block-route.md) (shipped
default-home fix)

Thin stub from smoke of day-block-route. **Not implementable yet.** Run
`/spec block-route-origin` next to flesh Approach / AC / Tasks before code.

## Problem

On a **combined** There drive, Hero/coverage leave-from is per event (“pick
Kian up at Haggerty”, “pick Declan up at Russell”). There is no surface to say
the **governing driver origin** for the merged itinerary (“I’m leaving from my
house” / override that start). `day-block-route` fixed combined HOME to the
membership **default** leave-from so kid places stay middles; parents still
need an explicit block-scoped “Leaving from …” when default isn’t right.

## Non-goals (sketch)

- Replacing per-event / per-kid pickup places (those stay middles)
- Public `/blocks/{id}/route` (still
  [`agenda-block-api`](agenda-block-api.md))
- Changing FROM end semantics beyond reusing the same governing origin
- Expo / KMP

## Notes

- Depends on `day-block-route` member-set cache + There/Back chrome.
- Likely UI: Route There chrome (and/or Agenda block card) origin control;
  persistence may be adult+member-set (or later block id) rather than per
  member item.
- Smoke trigger: Mites 6pm + Squirts 7pm @ Simoni with Haggerty / Russell /
  teammate house pickups — default home start is correct until override exists.
