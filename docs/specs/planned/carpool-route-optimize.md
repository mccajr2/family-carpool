# Spec stub: carpool-route-optimize

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-route-optimize`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Confirmed multi-stop rides already show an **ordered** pickup list and leave-by
([`ride-route-tab`](../archive/ride-route-tab.md)), but stop order is not chosen
for a short drive. Drivers need the app to **optimize stop order** (and refresh
leave-by / maps deep link) for neighborhood-style pickups — without live
turn-by-turn or a paid traffic product.

## Non-goals (sketch)

- Rebuilding the Route tab shell (already shipped)
- Live navigation inside the app / paid live traffic
- Playlist / music
- One-way legs or meet-at shapes (separate ids)
- Reviving cancelled `carpool-multi-stop` as a second Route UI

## Notes

- Builds on [`ride-route-tab`](../archive/ride-route-tab.md) + OSRM; prefer
  free/open routing for order search (matrix + short permutation / heuristic).
- Cancelled `carpool-multi-stop` already absorbed ordered stops + maps link —
  this id is **optimize only**, not a second multi-stop product surface.
- Manual reorder override? Decide at `/spec` (default: auto + optional drag).
- Web first.
